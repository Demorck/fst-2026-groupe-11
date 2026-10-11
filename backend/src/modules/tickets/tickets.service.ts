import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { generateTicketCode } from './ticket-code.js';

const MAX_CODE_ATTEMPTS = 3;

/** What the check-in page shows of a ticket. */
const checkinSelect = {
  id: true,
  code: true,
  status: true,
  checkedInAt: true,
  participant: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  /** Tickets of an event for its managers, filtered by participant name or ticket code. */
  async listForEvent(eventId: string, userId: string, search?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    await this.assertManager(userId, eventId);
    const term = search?.trim();
    return this.prisma.ticket.findMany({
      where: {
        eventId,
        ...(term && {
          OR: [
            { participant: { name: { contains: term, mode: 'insensitive' } } },
            { code: { contains: term, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { participant: { name: 'asc' } },
      select: checkinSelect,
    });
  }

  async checkIn(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { eventId: true, status: true, checkedInAt: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    await this.assertManager(userId, ticket.eventId);
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Ticket is cancelled');
    }
    try {
      // The condition makes a concurrent check-in of the same ticket fail instead of overwriting it
      return await this.prisma.ticket.update({
        where: {
          id: ticketId,
          checkedInAt: null,
          status: TicketStatus.RESERVED,
        },
        data: { checkedInAt: new Date() },
        select: checkinSelect,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new ConflictException('Already checked in');
      }
      throw error;
    }
  }

  private async assertManager(userId: string, eventId: string) {
    if (!(await this.organizations.canManageEvent(userId, eventId))) {
      throw new ForbiddenException('Not a manager of this event');
    }
  }

  /** Active tickets of a user, ordered by event start. */
  listForUser(participantId: string) {
    return this.prisma.ticket.findMany({
      where: { participantId, status: TicketStatus.RESERVED },
      orderBy: { event: { startsAt: 'asc' } },
      select: {
        id: true,
        code: true,
        status: true,
        checkedInAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            location: true,
          },
        },
      },
    });
  }

  async reserve(eventId: string, participantId: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Lock the event row: concurrent bookings of one event run one at a time,
          // so the capacity check below cannot be overtaken.
          const [event] = await tx.$queryRaw<
            { capacity: number; startsAt: Date }[]
          >`SELECT capacity, "startsAt" FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
          if (!event) {
            throw new NotFoundException('Event not found');
          }
          // Same rule as cancel: a ticket taken after the start could never be given back
          if (event.startsAt <= new Date()) {
            throw new ConflictException('Event already started');
          }

          const existing = await tx.ticket.findUnique({
            where: { eventId_participantId: { eventId, participantId } },
          });
          if (existing?.status === TicketStatus.RESERVED) {
            throw new ConflictException('Ticket already booked');
          }

          const booked = await tx.ticket.count({
            where: { eventId, status: TicketStatus.RESERVED },
          });
          if (booked >= event.capacity) {
            throw new ConflictException('Event is full');
          }

          // A cancelled ticket keeps its row (unique per event and participant): reactivate it
          if (existing) {
            return tx.ticket.update({
              where: { id: existing.id },
              data: { status: TicketStatus.RESERVED, checkedInAt: null },
            });
          }
          return tx.ticket.create({
            data: { eventId, participantId, code: generateTicketCode() },
          });
        });
      } catch (error) {
        // The failed insert aborts the transaction, so a code collision restarts it with a new code.
        // The event lock rules out a duplicate participant, so P2002 can only be the code.
        const collision = (error as { code?: string }).code === 'P2002';
        if (!collision || attempt >= MAX_CODE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  /** The participant gives their place back: the row stays as CANCELLED (and is reactivated by a new booking). */
  cancel(eventId: string, participantId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Same lock as reserve: a cancellation and a booking of one event never overlap
      const [event] = await tx.$queryRaw<{ startsAt: Date }[]>`
        SELECT "startsAt" FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      const ticket = await tx.ticket.findUnique({
        where: { eventId_participantId: { eventId, participantId } },
      });
      if (ticket?.status !== TicketStatus.RESERVED) {
        throw new NotFoundException('Ticket not found');
      }
      if (ticket.checkedInAt) {
        throw new ConflictException('Ticket already used');
      }
      if (event.startsAt <= new Date()) {
        throw new ConflictException('Event already started');
      }

      try {
        // The conditions make a check-in that commits in between win: the update then matches nothing
        return await tx.ticket.update({
          where: {
            id: ticket.id,
            status: TicketStatus.RESERVED,
            checkedInAt: null,
          },
          data: { status: TicketStatus.CANCELLED },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2025') {
          throw new ConflictException('Ticket already used');
        }
        throw error;
      }
    });
  }
}
