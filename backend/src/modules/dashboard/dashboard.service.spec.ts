import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { DashboardService } from './dashboard.service.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const shift = (startsInDays: number, required: number, registered: number) => ({
  id: `s${startsInDays}-${required}-${registered}`,
  title: 'Accueil',
  startsAt: inDays(startsInDays),
  endsAt: inDays(startsInDays + 0.1),
  requiredVolunteers: required,
  _count: { assignments: registered },
});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  title: 'Gala',
  startsAt: inDays(10),
  endsAt: inDays(10.1),
  location: 'Nancy',
  category: 'PARTY',
  capacity: 100,
  organizations: [
    { organization: { id: 'o1', name: 'BDE', logoContentType: null } },
  ],
  tickets: [] as { checkedInAt: Date | null }[],
  shifts: [] as ReturnType<typeof shift>[],
  ...overrides,
});

const reservations = (reserved: number, checkedIn = 0) =>
  Array.from({ length: reserved }, (_, i) => ({
    checkedInAt: i < checkedIn ? new Date() : null,
  }));

async function build({
  findUnique = vi.fn(),
  findMany = vi.fn(),
  canManageEvent = vi.fn().mockResolvedValue(true),
  listMine = vi.fn().mockResolvedValue([]),
} = {}) {
  const module = await Test.createTestingModule({
    providers: [
      DashboardService,
      { provide: PrismaService, useValue: { event: { findUnique, findMany } } },
      { provide: OrganizationsService, useValue: { canManageEvent, listMine } },
    ],
  }).compile();
  return module.get(DashboardService);
}

describe('DashboardService', () => {
  describe('stats of an event', () => {
    it('gives registrations, fill rate, attendance and volunteer coverage', async () => {
      const findUnique = vi.fn().mockResolvedValue(
        event({
          capacity: 40,
          tickets: reservations(30, 12),
          shifts: [shift(20, 3, 1), shift(20, 2, 2)],
        }),
      );

      const stats = await (await build({ findUnique })).stats('e1', 'boss');

      expect(stats).toMatchObject({
        reserved: 30,
        fillRate: 0.75,
        checkedIn: 12,
        volunteers: { required: 5, registered: 3, missing: 2 },
        organizations: [{ id: 'o1', name: 'BDE', hasLogo: false }],
      });
      expect(stats.shifts).toHaveLength(2);
      expect(stats.shifts[0]).toMatchObject({
        requiredVolunteers: 3,
        registered: 1,
      });
    });

    it('counts only reservations, never the cancelled ones', async () => {
      const findUnique = vi.fn().mockResolvedValue(event());

      await (await build({ findUnique })).stats('e1', 'boss');

      expect(findUnique.mock.calls[0][0].select.tickets.where).toEqual({
        status: 'RESERVED',
      });
    });

    it('answers 404 for an unknown event and 403 to someone who does not manage it', async () => {
      await expect(
        (await build({ findUnique: vi.fn().mockResolvedValue(null) })).stats(
          'e1',
          'boss',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        (
          await build({
            findUnique: vi.fn().mockResolvedValue(event()),
            canManageEvent: vi.fn().mockResolvedValue(false),
          })
        ).stats('e1', 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('risks', () => {
    const risksOf = async (row: Record<string, unknown>) =>
      (
        await (
          await build({ findUnique: vi.fn().mockResolvedValue(event(row)) })
        ).stats('e1', 'boss')
      ).risks;

    it('flags an event close in time and under 30% full', async () => {
      expect(
        (await risksOf({ startsAt: inDays(10), tickets: reservations(20) }))
          .lowFill,
      ).toBe(true);
    });

    it.each([
      ['far away', { startsAt: inDays(30), tickets: reservations(5) }],
      ['well filled', { startsAt: inDays(10), tickets: reservations(60) }],
      ['already over', { startsAt: inDays(-3), tickets: reservations(5) }],
    ])('does not flag an event %s', async (_why, row) => {
      expect((await risksOf(row)).lowFill).toBe(false);
    });

    it('flags an incomplete shift starting within 7 days', async () => {
      expect(
        (await risksOf({ shifts: [shift(3, 4, 1)] })).incompleteShifts,
      ).toBe(true);
    });

    it.each([
      ['full', [shift(3, 2, 2)]],
      ['far away', [shift(20, 4, 0)]],
      ['already started', [shift(-1, 4, 0)]],
      ['absent', []],
    ])('does not flag a shift that is %s', async (_why, shifts) => {
      expect((await risksOf({ shifts })).incompleteShifts).toBe(false);
    });
  });

  describe('overview', () => {
    const mine = [
      { id: 'o1', name: 'BDE', role: 'MANAGER' },
      { id: 'o2', name: 'Sport', role: 'MANAGER' },
      { id: 'o3', name: 'Autre', role: 'VOLUNTEER' },
    ];

    it('lists the events of every organization the user manages, and only those', async () => {
      const findMany = vi.fn().mockResolvedValue([event()]);
      const listMine = vi.fn().mockResolvedValue(mine);

      const result = await (
        await build({ findMany, listMine })
      ).overview('boss', {});

      expect(result.organizations.map((o) => o.id)).toEqual(['o1', 'o2']);
      expect(findMany.mock.calls[0][0].where.organizations).toEqual({
        some: { organizationId: { in: ['o1', 'o2'] } },
      });
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).not.toHaveProperty('shifts');
    });

    it('keeps the events of the last 30 days and the upcoming ones', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const listMine = vi.fn().mockResolvedValue(mine);

      await (await build({ findMany, listMine })).overview('boss', {});

      const since = findMany.mock.calls[0][0].where.startsAt.gte as Date;
      expect(Date.now() - since.getTime()).toBeGreaterThan(29.9 * DAY);
      expect(Date.now() - since.getTime()).toBeLessThan(30.1 * DAY);
    });

    it('restricts to one organization when asked', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const listMine = vi.fn().mockResolvedValue(mine);

      await (
        await build({ findMany, listMine })
      ).overview('boss', {
        organizationId: 'o2',
      });

      expect(findMany.mock.calls[0][0].where.organizations).toEqual({
        some: { organizationId: { in: ['o2'] } },
      });
    });

    it.each(['o3', 'unknown'])(
      'refuses the organization %s that the user does not manage',
      async (organizationId) => {
        const listMine = vi.fn().mockResolvedValue(mine);

        await expect(
          (await build({ listMine })).overview('boss', { organizationId }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });
});
