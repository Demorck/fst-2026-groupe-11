import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { UpdateShiftDto } from './dto/update-shift.dto.js';

function assertValidPeriod(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
}

@Injectable()
export class VolunteersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async listShifts(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    // A manager of one of the organizations running the event, not only its author
    const isOrganizer = await this.organizations.canManageEvent(
      userId,
      eventId,
    );
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
    if (!(await this.organizations.canManageEvent(userId, eventId))) {
      throw new ForbiddenException('Not a manager of this event');
    }
    return this.prisma.shift.create({ data: { ...dto, eventId } });
  }

  assign(shiftId: string, volunteerId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the shift row: concurrent sign-ups run one at a time, so the full check cannot be overtaken
      const [shift] = await tx.$queryRaw<
        {
          eventId: string;
          requiredVolunteers: number;
          startsAt: Date;
          endsAt: Date;
        }[]
      >`SELECT "eventId", "requiredVolunteers", "startsAt", "endsAt" FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
      if (!shift) {
        throw new NotFoundException('Shift not found');
      }
      // Same rule as the "can join" badge: past shifts are history (hours, attestations), not to be added
      if (shift.endsAt <= new Date()) {
        throw new ConflictException('Shift already ended');
      }
      // Volunteers only work for the organizations they belong to
      if (
        !(await this.organizations.isVolunteerOfEvent(
          volunteerId,
          shift.eventId,
        ))
      ) {
        throw new ForbiddenException(
          'Not a volunteer of an organization of this event',
        );
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
    const assignment = await this.prisma.shiftAssignment.findUnique({
      where: { shiftId_volunteerId: { shiftId, volunteerId } },
      select: { shift: { select: { endsAt: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Not registered on this shift');
    }
    // Past shifts are history (hours, attestation): nobody erases their own after the fact
    if (assignment.shift.endsAt <= new Date()) {
      throw new ConflictException('Shift already ended');
    }
    await this.prisma.shiftAssignment.deleteMany({
      where: { shiftId, volunteerId },
    });
  }

  async updateShift(id: string, dto: UpdateShiftDto, userId: string) {
    const shift = await this.findManagedShift(id, userId);
    // A partial update can break the order only against the stored date
    assertValidPeriod(
      dto.startsAt ?? shift.startsAt,
      dto.endsAt ?? shift.endsAt,
    );
    return this.prisma.shift.update({ where: { id }, data: dto });
  }

  async removeShift(id: string, userId: string) {
    await this.findManagedShift(id, userId);
    // Assignments have no cascade in the schema, so they go first
    await this.prisma.$transaction([
      this.prisma.shiftAssignment.deleteMany({ where: { shiftId: id } }),
      this.prisma.shift.delete({ where: { id } }),
    ]);
  }

  private async findManagedShift(id: string, userId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: { eventId: true, startsAt: true, endsAt: true },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    if (!(await this.organizations.canManageEvent(userId, shift.eventId))) {
      throw new ForbiddenException('Not a manager of this event');
    }
    return shift;
  }
}
