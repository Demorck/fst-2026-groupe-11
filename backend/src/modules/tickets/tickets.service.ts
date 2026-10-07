import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateTicketCode } from './ticket-code.js';

const MAX_CODE_ATTEMPTS = 3;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(eventId: string, participantId: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Lock the event row: concurrent bookings of one event run one at a time,
          // so the capacity check below cannot be overtaken.
          const [event] = await tx.$queryRaw<{ capacity: number }[]>`
            SELECT capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
          if (!event) {
            throw new NotFoundException('Event not found');
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
}
