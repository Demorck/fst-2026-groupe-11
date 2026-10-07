import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VolunteersService } from './volunteers.service.js';

const dto = {
  title: 'Bar',
  startsAt: new Date('2026-12-01T19:00:00Z'),
  endsAt: new Date('2026-12-01T21:00:00Z'),
  requiredVolunteers: 3,
};
const stored = { ...dto, id: 's1', event: { organizerId: 'org-1' } };

function setup({
  event = { organizerId: 'org-1' } as unknown,
  shift = stored as unknown,
} = {}) {
  return {
    event: { findUnique: vi.fn().mockResolvedValue(event) },
    shift: {
      findUnique: vi.fn().mockResolvedValue(shift),
      create: vi.fn().mockResolvedValue({ id: 's1' }),
      update: vi.fn().mockResolvedValue({ id: 's1' }),
      delete: vi.fn().mockReturnValue('delete-shift'),
    },
    shiftAssignment: {
      deleteMany: vi.fn().mockReturnValue('delete-assignments'),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
}

async function build(prisma: ReturnType<typeof setup>) {
  const module = await Test.createTestingModule({
    providers: [
      VolunteersService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(VolunteersService);
}

describe('VolunteersService.createShift', () => {
  it('creates the shift on the organizer own event', async () => {
    const prisma = setup();

    await (await build(prisma)).createShift('e1', dto, 'org-1');

    expect(prisma.shift.create).toHaveBeenCalledWith({
      data: { ...dto, eventId: 'e1' },
    });
  });

  it('refuses another organizer', async () => {
    const prisma = setup();

    await expect(
      (await build(prisma)).createShift('e1', dto, 'other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown event', async () => {
    const prisma = setup({ event: null });

    await expect(
      (await build(prisma)).createShift('e1', dto, 'org-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a shift that ends before it starts', async () => {
    const prisma = setup();

    await expect(
      (await build(prisma)).createShift(
        'e1',
        { ...dto, endsAt: dto.startsAt },
        'org-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });
});

describe('VolunteersService.updateShift', () => {
  it('updates only the given fields', async () => {
    const prisma = setup();

    await (
      await build(prisma)
    ).updateShift('s1', { requiredVolunteers: 5 }, 'org-1');

    expect(prisma.shift.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { requiredVolunteers: 5 },
    });
  });

  it('checks a new start against the stored end', async () => {
    const prisma = setup();

    await expect(
      (await build(prisma)).updateShift(
        's1',
        { startsAt: new Date('2026-12-01T22:00:00Z') },
        'org-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  it('refuses another organizer', async () => {
    const prisma = setup();

    await expect(
      (await build(prisma)).updateShift('s1', { title: 'Bar 2' }, 'other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown shift', async () => {
    const prisma = setup({ shift: null });

    await expect(
      (await build(prisma)).updateShift('s1', { title: 'Bar 2' }, 'org-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VolunteersService.removeShift', () => {
  it('deletes the assignments then the shift in one transaction', async () => {
    const prisma = setup();

    await (await build(prisma)).removeShift('s1', 'org-1');

    expect(prisma.$transaction).toHaveBeenCalledWith([
      'delete-assignments',
      'delete-shift',
    ]);
    expect(prisma.shiftAssignment.deleteMany).toHaveBeenCalledWith({
      where: { shiftId: 's1' },
    });
  });

  it('refuses another organizer', async () => {
    const prisma = setup();

    await expect(
      (await build(prisma)).removeShift('s1', 'other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
