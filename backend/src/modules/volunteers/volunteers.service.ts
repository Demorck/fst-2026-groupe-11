import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { UpdateShiftDto } from './dto/update-shift.dto.js';

function assertValidPeriod(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
}

@Injectable()
export class VolunteersService {
  constructor(private readonly prisma: PrismaService) {}

  async listShifts(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const isOrganizer = event.organizerId === userId;
    const shifts = await this.prisma.shift.findMany({
      where: { eventId },
      orderBy: { startsAt: 'asc' },
      include: {
        assignments: {
          select: { volunteer: { select: { id: true, name: true } } },
        },
      },
    });
    return shifts.map(({ assignments, ...shift }) => ({
      ...shift,
      registered: assignments.length,
      assigned: assignments.some((a) => a.volunteer.id === userId),
      // Only the organizer sees who signed up
      ...(isOrganizer && { volunteers: assignments.map((a) => a.volunteer) }),
    }));
  }

  async createShift(eventId: string, dto: CreateShiftDto, userId: string) {
    assertValidPeriod(dto.startsAt, dto.endsAt);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Not the organizer of this event');
    }
    return this.prisma.shift.create({ data: { ...dto, eventId } });
  }

  assign(shiftId: string, volunteerId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the shift row: concurrent sign-ups run one at a time, so the full check cannot be overtaken
      const [shift] = await tx.$queryRaw<
        { requiredVolunteers: number; startsAt: Date; endsAt: Date }[]
      >`SELECT "requiredVolunteers", "startsAt", "endsAt" FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      const existing = await tx.shiftAssignment.findUnique({
        where: { shiftId_volunteerId: { shiftId, volunteerId } },
      });
      if (existing) {
        throw new ConflictException('Already registered');
      }
      const taken = await tx.shiftAssignment.count({ where: { shiftId } });
      if (taken >= shift.requiredVolunteers) {
        throw new ConflictException('Shift is full');
      }
      // Any event: a volunteer cannot be in two places at once
      const overlapping = await tx.shiftAssignment.findFirst({
        where: {
          volunteerId,
          shift: {
            startsAt: { lt: shift.endsAt },
            endsAt: { gt: shift.startsAt },
          },
        },
      });
      if (overlapping) {
        throw new ConflictException('Overlaps another of your shifts');
      }
      return tx.shiftAssignment.create({ data: { shiftId, volunteerId } });
    });
  }

  async unassign(shiftId: string, volunteerId: string) {
    const { count } = await this.prisma.shiftAssignment.deleteMany({
      where: { shiftId, volunteerId },
    });
    if (count === 0) {
      throw new NotFoundException('Not registered on this shift');
    }
  }

  async updateShift(id: string, dto: UpdateShiftDto, userId: string) {
    const shift = await this.findOwnedShift(id, userId);
    // A partial update can break the order only against the stored date
    assertValidPeriod(
      dto.startsAt ?? shift.startsAt,
      dto.endsAt ?? shift.endsAt,
    );
    return this.prisma.shift.update({ where: { id }, data: dto });
  }

  async removeShift(id: string, userId: string) {
    await this.findOwnedShift(id, userId);
    // Assignments have no cascade in the schema, so they go first
    await this.prisma.$transaction([
      this.prisma.shiftAssignment.deleteMany({ where: { shiftId: id } }),
      this.prisma.shift.delete({ where: { id } }),
    ]);
  }

  private async findOwnedShift(id: string, userId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { event: { select: { organizerId: true } } },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    if (shift.event.organizerId !== userId) {
      throw new ForbiddenException('Not the organizer of this event');
    }
    return shift;
  }
}
