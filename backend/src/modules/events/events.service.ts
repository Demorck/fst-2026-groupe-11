import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketStatus } from '@/generated/prisma/enums.js';
import { hasRole } from '@/common/roles.js';
import type { AuthUser } from '@/common/guards/jwt-auth.guard.js';
import {
  OrganizationsService,
  type VolunteerStatus,
} from '../organizations/organizations.service.js';
import { omitLogo, toPublic } from '../organizations/public-organization.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';

// select only public organizer fields: never leak passwordHash or email
const include = {
  organizer: { select: { id: true, name: true } },
  organizations: {
    select: { organization: { omit: omitLogo } },
    orderBy: { createdAt: 'asc' as const },
  },
  shifts: {
    select: {
      requiredVolunteers: true,
      endsAt: true,
      _count: { select: { assignments: true } },
    },
  },
  _count: {
    select: { tickets: { where: { status: TicketStatus.RESERVED } } },
  },
};

/** How many volunteers the shifts of an event still need. */
function volunteerCoverage(
  shifts: { requiredVolunteers: number; _count: { assignments: number } }[],
) {
  const required = shifts.reduce((sum, s) => sum + s.requiredVolunteers, 0);
  const missing = shifts.reduce(
    (sum, s) => sum + Math.max(0, s.requiredVolunteers - s._count.assignments),
    0,
  );
  return { required, registered: required - missing, missing };
}

/** A volunteer can only join a shift that is still to come and not full. */
function hasOpenShift(
  shifts: {
    requiredVolunteers: number;
    endsAt: Date;
    _count: { assignments: number };
  }[],
) {
  const now = new Date();
  return shifts.some(
    (s) => s.endsAt > now && s._count.assignments < s.requiredVolunteers,
  );
}

function present<
  T extends {
    id: string;
    capacity: number;
    _count: { tickets: number };
    organizations: { organization: { logoContentType: string | null } }[];
    shifts: {
      requiredVolunteers: number;
      endsAt: Date;
      _count: { assignments: number };
    }[];
  },
>(
  { _count, organizations, shifts, ...event }: T,
  statuses: Map<string, VolunteerStatus>,
) {
  const status = statuses.get(event.id);
  return {
    ...event,
    remainingSeats: event.capacity - _count.tickets,
    organizations: organizations.map(({ organization }) =>
      toPublic(organization),
    ),
    volunteers: volunteerCoverage(shifts),
    // Only for a logged in volunteer of one of the organizations, or already on a shift.
    // "Can join" needs a shift to join: without one the badge would promise nothing.
    volunteerStatus:
      status === 'AVAILABLE' && !hasOpenShift(shifts) ? null : (status ?? null),
  };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(
    { organizationIds, ...data }: CreateEventDto,
    organizerId: string,
  ) {
    if (data.endsAt <= data.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    // An event always belongs to at least one organization the author manages
    await this.organizations.assertManagesAll(organizerId, organizationIds);
    const event = await this.prisma.event.create({
      data: {
        ...data,
        organizerId,
        organizations: {
          create: organizationIds.map((organizationId) => ({ organizationId })),
        },
      },
      include: {
        organizations: {
          select: { organization: { select: { id: true, name: true } } },
        },
      },
    });
    const { organizations, ...rest } = event;
    return {
      ...rest,
      organizations: organizations.map(({ organization }) => organization),
    };
  }

  async findAll(
    { from, to, category, organizationId }: ListEventsQueryDto,
    user?: AuthUser,
  ) {
    const events = await this.prisma.event.findMany({
      where: {
        category,
        startsAt: { gte: from, lte: to },
        ...(organizationId && { organizations: { some: { organizationId } } }),
      },
      orderBy: { startsAt: 'asc' },
      include,
    });
    const statuses = await this.volunteerStatuses(
      user,
      events.map(({ id }) => id),
    );
    return events.map((event) => present(event, statuses));
  }

  async findOne(id: string, user?: AuthUser) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include,
    });
    if (!event) throw new NotFoundException('Event not found');
    const canManage =
      user?.role === Role.ORGANIZER &&
      (await this.organizations.canManageEvent(user.id, id));
    // Opens the shifts page: the API refuses it to who is in no organization of the event
    const canVolunteer =
      !!user &&
      hasRole(user.role, Role.VOLUNTEER) &&
      (await this.organizations.isVolunteerOfEvent(user.id, id));
    return {
      ...present(event, await this.volunteerStatuses(user, [id])),
      canManage,
      canVolunteer,
    };
  }

  async update(
    id: string,
    { organizationIds, ...data }: UpdateEventDto,
    user: AuthUser,
  ) {
    await this.assertCanManage(user.id, id);
    await this.prisma.$transaction(async (tx) => {
      // Same lock as a booking: no ticket can be taken between the capacity check and the update
      const [event] = await tx.$queryRaw<{ startsAt: Date; endsAt: Date }[]>`
        SELECT "startsAt", "endsAt" FROM "Event" WHERE id = ${id} FOR UPDATE`;
      if (!event) throw new NotFoundException('Event not found');
      if ((data.endsAt ?? event.endsAt) <= (data.startsAt ?? event.startsAt)) {
        throw new BadRequestException('endsAt must be after startsAt');
      }
      if (data.capacity !== undefined) {
        const reserved = await tx.ticket.count({
          where: { eventId: id, status: TicketStatus.RESERVED },
        });
        if (data.capacity < reserved) {
          throw new ConflictException(
            'Capacity is below the number of reserved tickets',
          );
        }
      }

      let organizations = {};
      if (organizationIds) {
        const current = (
          await tx.eventOrganization.findMany({
            where: { eventId: id },
            select: { organizationId: true },
          })
        ).map(({ organizationId }) => organizationId);
        const added = organizationIds.filter((o) => !current.includes(o));
        const removed = current.filter((o) => !organizationIds.includes(o));
        // Co-organizing organizations the user does not manage stay untouched
        await this.organizations.assertManagesAll(user.id, [
          ...added,
          ...removed,
        ]);
        // Their members' shifts count in the organization's hours and attestations
        if (
          removed.length > 0 &&
          (await tx.shiftAssignment.count({
            where: {
              shift: { eventId: id },
              volunteer: {
                memberships: { some: { organizationId: { in: removed } } },
              },
            },
          })) > 0
        ) {
          throw new ConflictException(
            'Volunteers of a removed organization are on a shift',
          );
        }
        organizations = {
          organizations: {
            deleteMany: { organizationId: { in: removed } },
            create: added.map((organizationId) => ({ organizationId })),
          },
        };
      }

      await tx.event.update({
        where: { id },
        data: { ...data, ...organizations },
      });
    });
    return this.findOne(id, user);
  }

  async remove(id: string, userId: string) {
    await this.assertCanManage(userId, id);
    await this.prisma.$transaction(async (tx) => {
      // Same lock as a booking: no ticket can be taken while the event goes away
      const [event] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE`;
      // Deleted meanwhile by another manager
      if (!event) throw new NotFoundException('Event not found');
      const reserved = await tx.ticket.count({
        where: { eventId: id, status: TicketStatus.RESERVED },
      });
      const assignments = await tx.shiftAssignment.count({
        where: { shift: { eventId: id } },
      });
      // Tickets and volunteer hours are history (attendance prediction, attestations)
      if (reserved > 0 || assignments > 0) {
        throw new ConflictException('Event has tickets or volunteers');
      }
      // Only cancelled tickets are left; shifts and organization links cascade
      await tx.ticket.deleteMany({ where: { eventId: id } });
      await tx.event.delete({ where: { id } });
    });
  }

  private async assertCanManage(userId: string, eventId: string) {
    if ((await this.prisma.event.count({ where: { id: eventId } })) === 0) {
      throw new NotFoundException('Event not found');
    }
    if (!(await this.organizations.canManageEvent(userId, eventId))) {
      throw new ForbiddenException('Not a manager of this event');
    }
  }

  // The badge concerns volunteers and organizers: participants and visitors skip the query
  private volunteerStatuses(user: AuthUser | undefined, eventIds: string[]) {
    return user && hasRole(user.role, Role.VOLUNTEER)
      ? this.organizations.volunteerStatuses(user.id, eventIds)
      : Promise.resolve(new Map<string, VolunteerStatus>());
  }
}
