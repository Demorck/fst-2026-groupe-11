import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '@/generated/prisma/enums.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { omitLogo, toPublic } from '../organizations/public-organization.js';
import type { DashboardQueryDto } from './dto/dashboard-query.dto.js';

// An event is "at risk" when it is close and still short: too few reservations, or a shift not full
export const LOW_FILL_RATE = 0.3;
export const LOW_FILL_WINDOW_DAYS = 14;
export const INCOMPLETE_SHIFT_WINDOW_DAYS = 7;
// Past events stay on the dashboard this long, to read how they went
const PAST_EVENTS_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

const eventSelect = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  location: true,
  category: true,
  capacity: true,
  organizations: {
    select: { organization: { omit: omitLogo } },
    orderBy: { createdAt: 'asc' as const },
  },
  // One row per reservation: capacity bounds it, and it gives both counts (reserved, checked in)
  tickets: {
    where: { status: TicketStatus.RESERVED },
    select: { checkedInAt: true },
  },
  shifts: {
    orderBy: { startsAt: 'asc' as const },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      requiredVolunteers: true,
      _count: { select: { assignments: true } },
    },
  },
};

type EventRow = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string;
  category: string;
  capacity: number;
  organizations: { organization: { logoContentType: string | null } }[];
  tickets: { checkedInAt: Date | null }[];
  shifts: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    requiredVolunteers: number;
    _count: { assignments: number };
  }[];
};

const shiftRows = (shifts: EventRow['shifts']) =>
  shifts.map(({ _count, ...shift }) => ({
    ...shift,
    registered: _count.assignments,
  }));

/** Indicators of one event (step 5 of the journey): registrations, filling, attendance, volunteers. */
function indicators({
  organizations,
  tickets,
  shifts: shiftData,
  ...event
}: EventRow) {
  const now = Date.now();
  const reserved = tickets.length;
  const fillRate = Math.round((reserved / event.capacity) * 100) / 100;
  const shifts = shiftRows(shiftData);
  const required = shifts.reduce((sum, s) => sum + s.requiredVolunteers, 0);
  const missing = shifts.reduce(
    (sum, s) => sum + Math.max(0, s.requiredVolunteers - s.registered),
    0,
  );
  const startsInDays = (event.startsAt.getTime() - now) / DAY;

  return {
    ...event,
    organizations: organizations.map(({ organization }) =>
      toPublic(organization),
    ),
    reserved,
    fillRate,
    checkedIn: tickets.filter((ticket) => ticket.checkedInAt).length,
    volunteers: { required, registered: required - missing, missing },
    risks: {
      lowFill:
        startsInDays > 0 &&
        startsInDays <= LOW_FILL_WINDOW_DAYS &&
        fillRate < LOW_FILL_RATE,
      incompleteShifts: shifts.some((shift) => {
        const inDays = (shift.startsAt.getTime() - now) / DAY;
        return (
          inDays > 0 &&
          inDays <= INCOMPLETE_SHIFT_WINDOW_DAYS &&
          shift.registered < shift.requiredVolunteers
        );
      }),
    },
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  /** Indicators of one event, for a manager of one of its organizations. */
  async stats(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: eventSelect,
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!(await this.organizations.canManageEvent(userId, eventId))) {
      throw new ForbiddenException('Not a manager of this event');
    }
    // The detail of the shifts is only worth it for one event
    return { ...indicators(event), shifts: shiftRows(event.shifts) };
  }

  /**
   * The events of every organization the user manages (not only the ones they created),
   * upcoming ones and the last 30 days, with the managed organizations for the selector.
   */
  async overview(userId: string, { organizationId }: DashboardQueryDto) {
    const managed = (await this.organizations.listMine(userId)).filter(
      ({ role }) => role === 'MANAGER',
    );
    if (organizationId && !managed.some(({ id }) => id === organizationId)) {
      throw new ForbiddenException('You do not manage this organization');
    }
    const ids = organizationId ? [organizationId] : managed.map(({ id }) => id);

    const events = await this.prisma.event.findMany({
      where: {
        organizations: { some: { organizationId: { in: ids } } },
        startsAt: { gte: new Date(Date.now() - PAST_EVENTS_DAYS * DAY) },
      },
      orderBy: { startsAt: 'asc' },
      select: eventSelect,
    });
    return {
      organizations: managed,
      events: events.map(indicators),
    };
  }
}
