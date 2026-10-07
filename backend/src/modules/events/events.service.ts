import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '@/generated/prisma/enums.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';

// select only public organizer fields: never leak passwordHash or email
const include = {
  organizer: { select: { id: true, name: true } },
  _count: {
    select: { tickets: { where: { status: TicketStatus.RESERVED } } },
  },
};

function withRemainingSeats<
  T extends { capacity: number; _count: { tickets: number } },
>({ _count, ...event }: T) {
  return { ...event, remainingSeats: event.capacity - _count.tickets };
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

  async findAll({ from, to, category }: ListEventsQueryDto) {
    const events = await this.prisma.event.findMany({
      where: { category, startsAt: { gte: from, lte: to } },
      orderBy: { startsAt: 'asc' },
      include,
    });
    return events.map(withRemainingSeats);
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include,
    });
    if (!event) throw new NotFoundException('Event not found');
    return withRemainingSeats(event);
  }
}
