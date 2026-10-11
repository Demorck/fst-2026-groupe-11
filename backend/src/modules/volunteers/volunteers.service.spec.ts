import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { VolunteersService } from './volunteers.service.js';

const dto = {
  title: 'Bar',
  startsAt: new Date('2026-12-01T19:00:00Z'),
  endsAt: new Date('2026-12-01T21:00:00Z'),
  requiredVolunteers: 3,
};
const stored = { ...dto, id: 's1', eventId: 'e1' };

// 'org-1' manages the event through one of its organizations; nobody else does
const organizationsMock = (overrides: Record<string, unknown> = {}) => ({
  canManageEvent: vi.fn((userId: string) =>
    Promise.resolve(userId === 'org-1'),
  ),
  isVolunteerOfEvent: vi.fn().mockResolvedValue(true),
  ...overrides,
});

function setup({
  // the author is not who decides: rights come from the organizations of the event
  event = { id: 'e1', organizerId: 'author' } as unknown,
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

async function build(
  prisma: ReturnType<typeof setup>,
  organizations = organizationsMock(),
) {
  const module = await Test.createTestingModule({
    providers: [
      VolunteersService,
      { provide: PrismaService, useValue: prisma },
      { provide: OrganizationsService, useValue: organizations },
    ],
  }).compile();
  return module.get(VolunteersService);
}

describe('VolunteersService.createShift', () => {
  it('creates the shift for a manager of an organization of the event', async () => {
    const prisma = setup();

    await (await build(prisma)).createShift('e1', dto, 'org-1');

    expect(prisma.shift.create).toHaveBeenCalledWith({
      data: { ...dto, eventId: 'e1' },
    });
  });

  it('refuses the author of the event when no organization of it is theirs', async () => {
    const prisma = setup();
    const organizations = organizationsMock({
      canManageEvent: vi.fn().mockResolvedValue(false),
    });

    await expect(
      (await build(prisma, organizations)).createShift('e1', dto, 'author'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(organizations.canManageEvent).toHaveBeenCalledWith('author', 'e1');
    expect(prisma.shift.create).not.toHaveBeenCalled();
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

describe('VolunteersService.listShifts', () => {
  const rows = [
    {
      ...dto,
      id: 's1',
      assignments: [
        { volunteer: { id: 'v1', name: 'Alice' } },
        { volunteer: { id: 'v2', name: 'Bob' } },
      ],
    },
    { ...dto, id: 's2', assignments: [] },
  ];

  function setupList(event: unknown = { id: 'e1' }) {
    const prisma = setup({ event });
    return Object.assign(prisma, {
      shift: { ...prisma.shift, findMany: vi.fn().mockResolvedValue(rows) },
    });
  }

  it('counts the registered volunteers and flags my own shifts', async () => {
    const prisma = setupList();

    const result = await (await build(prisma)).listShifts('e1', 'v1');

    expect(result.map((s) => [s.registered, s.assigned])).toEqual([
      [2, true],
      [0, false],
    ]);
    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'e1' },
        orderBy: { startsAt: 'asc' },
      }),
    );
  });

  it('hides the volunteer list from everyone but the managers', async () => {
    const result = await (await build(setupList())).listShifts('e1', 'v1');

    expect(result[0]).not.toHaveProperty('volunteers');
    expect(result[0]).not.toHaveProperty('assignments');
  });

  it('gives a manager of the event the volunteer list', async () => {
    const result = await (await build(setupList())).listShifts('e1', 'org-1');

    expect(result[0].volunteers).toEqual([
      { id: 'v1', name: 'Alice' },
      { id: 'v2', name: 'Bob' },
    ]);
  });

  it('throws 404 for an unknown event', async () => {
    await expect(
      (await build(setupList(null))).listShifts('e1', 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VolunteersService.assign', () => {
  // Relative dates: assign() refuses a shift that has ended
  const inOneDay = Date.now() + 86_400_000;
  const shiftRow = {
    eventId: 'e1',
    requiredVolunteers: 2,
    startsAt: new Date(inOneDay),
    endsAt: new Date(inOneDay + 2 * 3_600_000),
  };

  function setupAssign({
    shift = shiftRow as unknown,
    existing = null as unknown,
    taken = 0,
    overlapping = null as unknown,
  } = {}) {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue(shift ? [shift] : []),
      shiftAssignment: {
        findUnique: vi.fn().mockResolvedValue(existing),
        count: vi.fn().mockResolvedValue(taken),
        findFirst: vi.fn().mockResolvedValue(overlapping),
        create: vi.fn().mockResolvedValue({ id: 'a1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    return { tx, prisma };
  }

  const run = async (
    setupResult: ReturnType<typeof setupAssign>,
    organizations = organizationsMock(),
  ) => {
    const module = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: PrismaService, useValue: setupResult.prisma },
        { provide: OrganizationsService, useValue: organizations },
      ],
    }).compile();
    return module.get(VolunteersService).assign('s1', 'v1');
  };

  it('refuses a shift that has already ended, but not one in progress', async () => {
    const ended = {
      ...shiftRow,
      startsAt: new Date(Date.now() - 3 * 3_600_000),
      endsAt: new Date(Date.now() - 3_600_000),
    };
    const s = setupAssign({ shift: ended });
    await expect(run(s)).rejects.toThrow('Shift already ended');
    expect(s.tx.shiftAssignment.create).not.toHaveBeenCalled();

    const running = {
      ...shiftRow,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 3_600_000),
    };
    await run(setupAssign({ shift: running }));
  });

  it('registers the volunteer', async () => {
    const s = setupAssign();

    await run(s);

    expect(s.tx.shiftAssignment.create).toHaveBeenCalledWith({
      data: { shiftId: 's1', volunteerId: 'v1' },
    });
  });

  it('refuses a volunteer who belongs to no organization of the event, before anything else', async () => {
    const s = setupAssign();
    const organizations = organizationsMock({
      isVolunteerOfEvent: vi.fn().mockResolvedValue(false),
    });

    await expect(run(s, organizations)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(organizations.isVolunteerOfEvent).toHaveBeenCalledWith('v1', 'e1');
    expect(s.tx.shiftAssignment.count).not.toHaveBeenCalled();
    expect(s.tx.shiftAssignment.create).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown shift', async () => {
    await expect(run(setupAssign({ shift: null }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 409 when the shift is full', async () => {
    const s = setupAssign({ taken: 2 });

    await expect(run(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.tx.shiftAssignment.create).not.toHaveBeenCalled();
  });

  it('throws 409 when already registered', async () => {
    const s = setupAssign({ existing: { id: 'a0' } });

    await expect(run(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.tx.shiftAssignment.create).not.toHaveBeenCalled();
  });

  it('throws 409 on an overlap with another shift of the volunteer', async () => {
    const s = setupAssign({ overlapping: { id: 'a9' } });

    await expect(run(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.tx.shiftAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        volunteerId: 'v1',
        shift: {
          startsAt: { lt: shiftRow.endsAt },
          endsAt: { gt: shiftRow.startsAt },
        },
      },
    });
    expect(s.tx.shiftAssignment.create).not.toHaveBeenCalled();
  });
});

describe('VolunteersService.unassign', () => {
  async function run(assignment: { shift: { endsAt: Date } } | null) {
    const findUnique = vi.fn().mockResolvedValue(assignment);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const module = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: PrismaService,
          useValue: { shiftAssignment: { findUnique, deleteMany } },
        },
        { provide: OrganizationsService, useValue: organizationsMock() },
      ],
    }).compile();
    const result = module.get(VolunteersService).unassign('s1', 'v1');
    return { findUnique, deleteMany, result };
  }

  const upcoming = { shift: { endsAt: new Date(Date.now() + 3_600_000) } };

  it('removes only the own assignment', async () => {
    const { findUnique, deleteMany, result } = await run(upcoming);
    await result;

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shiftId_volunteerId: { shiftId: 's1', volunteerId: 'v1' } },
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { shiftId: 's1', volunteerId: 'v1' },
    });
  });

  it('throws 404 when not registered', async () => {
    const { deleteMany, result } = await run(null);

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('keeps the hours of a shift that has ended: 409', async () => {
    const { deleteMany, result } = await run({
      shift: { endsAt: new Date(Date.now() - 1000) },
    });

    await expect(result).rejects.toThrow('Shift already ended');
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
