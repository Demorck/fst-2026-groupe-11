import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, TicketStatus } from '@/generated/prisma/enums.js';
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
  _count: {
    select: { tickets: { where: { status: TicketStatus.RESERVED } } },
  },
};

function present<
  T extends {
    id: string;
    capacity: number;
    _count: { tickets: number };
    organizations: { organization: { logoContentType: string | null } }[];
  },
>(
  { _count, organizations, ...event }: T,
  statuses: Map<string, VolunteerStatus>,
) {
  return {
    ...event,
    remainingSeats: event.capacity - _count.tickets,
    organizations: organizations.map(({ organization }) =>
      toPublic(organization),
    ),
    // Only for a logged in volunteer of one of the organizations, or already on a shift
    volunteerStatus: statuses.get(event.id) ?? null,
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

  async findAll({ from, to, category }: ListEventsQueryDto, user?: AuthUser) {
    const events = await this.prisma.event.findMany({
      where: { category, startsAt: { gte: from, lte: to } },
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
    return present(event, await this.volunteerStatuses(user, [id]));
  }

  // The badge only concerns volunteers: other roles and visitors skip the query
  private volunteerStatuses(user: AuthUser | undefined, eventIds: string[]) {
    return user?.role === Role.VOLUNTEER
      ? this.organizations.volunteerStatuses(user.id, eventIds)
      : Promise.resolve(new Map<string, VolunteerStatus>());
  }
}
