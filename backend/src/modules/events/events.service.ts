import {
  BadRequestException,
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
    return {
      ...present(event, await this.volunteerStatuses(user, [id])),
      canManage,
    };
  }

  // The badge concerns volunteers and organizers: participants and visitors skip the query
  private volunteerStatuses(user: AuthUser | undefined, eventIds: string[]) {
    return user && hasRole(user.role, Role.VOLUNTEER)
      ? this.organizations.volunteerStatuses(user.id, eventIds)
      : Promise.resolve(new Map<string, VolunteerStatus>());
  }
}
