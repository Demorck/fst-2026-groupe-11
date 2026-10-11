import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventCategory, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { EventsService } from './events.service.js';

const dto = {
  title: 'Gala',
  description: 'Soirée de fin d’année',
  startsAt: new Date('2026-12-01T19:00:00Z'),
  endsAt: new Date('2026-12-01T23:00:00Z'),
  location: 'Nancy',
  capacity: 50,
  category: EventCategory.PARTY,
  organizationIds: ['o1', 'o2'],
};

async function build(
  event: Record<string, ReturnType<typeof vi.fn>>,
  organizations: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  const module = await Test.createTestingModule({
    providers: [
      EventsService,
      { provide: PrismaService, useValue: { event } },
      {
        provide: OrganizationsService,
        useValue: {
          assertManagesAll: vi.fn().mockResolvedValue(undefined),
          volunteerStatuses: vi.fn().mockResolvedValue(new Map()),
          canManageEvent: vi.fn().mockResolvedValue(false),
          isVolunteerOfEvent: vi.fn().mockResolvedValue(false),
          ...organizations,
        },
      },
    ],
  }).compile();
  return module.get(EventsService);
}

describe('EventsService', () => {
  it('stores the logged in organizer as author and links every organization', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'e1', organizations: [] });
    await (await build({ create })).create(dto, 'user-1');

    const { organizationIds: _ids, ...fields } = dto;
    expect(create.mock.calls[0][0].data).toEqual({
      ...fields,
      organizerId: 'user-1',
      organizations: {
        create: [{ organizationId: 'o1' }, { organizationId: 'o2' }],
      },
    });
  });

  it('returns the organizations as a flat list of id and name', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'e1',
      organizations: [{ organization: { id: 'o1', name: 'BDE' } }],
    });

    const event = await (await build({ create })).create(dto, 'user-1');

    expect(event.organizations).toEqual([{ id: 'o1', name: 'BDE' }]);
  });

  it('refuses organizations the author does not manage', async () => {
    const create = vi.fn();
    const assertManagesAll = vi
      .fn()
      .mockRejectedValue(new ForbiddenException());

    await expect(
      (await build({ create }, { assertManagesAll })).create(dto, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertManagesAll).toHaveBeenCalledWith('user-1', ['o1', 'o2']);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an event that ends before it starts', async () => {
    const create = vi.fn();
    const service = await build({ create });

    await expect(
      service.create({ ...dto, endsAt: dto.startsAt }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('lists filtered events by date with remaining seats', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'e1',
        capacity: 50,
        _count: { tickets: 12 },
        organizations: [],
        shifts: [],
      },
    ]);
    const from = new Date('2026-12-01');

    const events = await (
      await build({ findMany })
    ).findAll({ from, category: EventCategory.PARTY });

    expect(events).toEqual([
      {
        id: 'e1',
        capacity: 50,
        remainingSeats: 38,
        organizations: [],
        volunteers: { required: 0, registered: 0, missing: 0 },
        volunteerStatus: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          category: EventCategory.PARTY,
          startsAt: { gte: from, lte: undefined },
        },
        orderBy: { startsAt: 'asc' },
      }),
    );
  });

  it('returns the event detail with remaining seats', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'e1',
      capacity: 50,
      organizer: { id: 'org-1', name: 'Asso' },
      organizations: [],
      shifts: [],
      _count: { tickets: 50 },
    });

    await expect((await build({ findUnique })).findOne('e1')).resolves.toEqual({
      id: 'e1',
      capacity: 50,
      organizer: { id: 'org-1', name: 'Asso' },
      organizations: [],
      volunteers: { required: 0, registered: 0, missing: 0 },
      remainingSeats: 0,
      volunteerStatus: null,
      canManage: false,
      canVolunteer: false,
    });
  });

  describe('canManage', () => {
    const row = {
      id: 'e1',
      capacity: 10,
      _count: { tickets: 0 },
      shifts: [],
      organizations: [],
    };

    it.each([
      ['an organizer who manages the event', true],
      ['an organizer who does not', false],
    ])('tells %s', async (_who, manages) => {
      const findUnique = vi.fn().mockResolvedValue(row);
      const canManageEvent = vi.fn().mockResolvedValue(manages);

      const event = await (
        await build({ findUnique }, { canManageEvent })
      ).findOne('e1', { id: 'u1', role: Role.ORGANIZER });

      expect(canManageEvent).toHaveBeenCalledWith('u1', 'e1');
      expect(event.canManage).toBe(manages);
    });

    it.each([
      ['a volunteer', { id: 'u1', role: Role.VOLUNTEER }],
      ['a visitor', undefined],
    ])('never asks for %s', async (_who, user) => {
      const findUnique = vi.fn().mockResolvedValue(row);
      const canManageEvent = vi.fn();

      const event = await (
        await build({ findUnique }, { canManageEvent })
      ).findOne('e1', user);

      expect(canManageEvent).not.toHaveBeenCalled();
      expect(event.canManage).toBe(false);
    });
  });

  describe('canVolunteer', () => {
    const row = {
      id: 'e1',
      capacity: 10,
      _count: { tickets: 0 },
      shifts: [],
      organizations: [],
    };

    it.each([
      ['a volunteer of an organization of the event', Role.VOLUNTEER, true],
      ['a volunteer of another organization', Role.VOLUNTEER, false],
      ['a manager of an organization of the event', Role.ORGANIZER, true],
    ])('tells %s', async (_who, role, member) => {
      const findUnique = vi.fn().mockResolvedValue(row);
      const isVolunteerOfEvent = vi.fn().mockResolvedValue(member);

      const event = await (
        await build({ findUnique }, { isVolunteerOfEvent })
      ).findOne('e1', { id: 'u1', role });

      expect(isVolunteerOfEvent).toHaveBeenCalledWith('u1', 'e1');
      expect(event.canVolunteer).toBe(member);
    });

    it.each([
      ['a participant', { id: 'u1', role: Role.PARTICIPANT }],
      ['a visitor', undefined],
    ])('never asks for %s', async (_who, user) => {
      const findUnique = vi.fn().mockResolvedValue(row);
      const isVolunteerOfEvent = vi.fn();

      const event = await (
        await build({ findUnique }, { isVolunteerOfEvent })
      ).findOne('e1', user);

      expect(isVolunteerOfEvent).not.toHaveBeenCalled();
      expect(event.canVolunteer).toBe(false);
    });
  });

  describe('organizations on events', () => {
    const openShift = {
      requiredVolunteers: 2,
      endsAt: new Date(Date.now() + 86_400_000),
      _count: { assignments: 1 },
    };
    const rows = [
      {
        id: 'e1',
        capacity: 10,
        _count: { tickets: 0 },
        shifts: [],
        organizations: [
          {
            organization: {
              id: 'o1',
              name: 'BDE',
              logoContentType: 'image/png',
            },
          },
          { organization: { id: 'o2', name: 'Sport', logoContentType: null } },
        ],
      },
      {
        id: 'e2',
        capacity: 10,
        _count: { tickets: 0 },
        shifts: [],
        organizations: [],
      },
    ];

    it('lists the organizations of each event, with hasLogo and no logo bytes', async () => {
      const findMany = vi.fn().mockResolvedValue(rows);

      const [first] = await (await build({ findMany })).findAll({});

      expect(first.organizations).toEqual([
        { id: 'o1', name: 'BDE', hasLogo: true },
        { id: 'o2', name: 'Sport', hasLogo: false },
      ]);
      expect(
        findMany.mock.calls[0][0].include.organizations.select.organization,
      ).toEqual({
        omit: { logo: true },
      });
    });

    it('gives a logged in volunteer the status of each event', async () => {
      const findMany = vi.fn().mockResolvedValue(rows);
      const volunteerStatuses = vi
        .fn()
        .mockResolvedValue(new Map([['e1', 'ASSIGNED']]));

      const events = await (
        await build({ findMany }, { volunteerStatuses })
      ).findAll({}, { id: 'u1', role: Role.VOLUNTEER });

      expect(volunteerStatuses).toHaveBeenCalledWith('u1', ['e1', 'e2']);
      expect(events.map((event) => event.volunteerStatus)).toEqual([
        'ASSIGNED',
        null,
      ]);
    });

    it('also gives an organizer the status (organizers inherit volunteer rights)', async () => {
      const findMany = vi.fn().mockResolvedValue(rows);
      const volunteerStatuses = vi.fn().mockResolvedValue(new Map());

      await (
        await build({ findMany }, { volunteerStatuses })
      ).findAll({}, { id: 'u1', role: Role.ORGANIZER });

      expect(volunteerStatuses).toHaveBeenCalledWith('u1', ['e1', 'e2']);
    });

    it.each([
      ['a participant', { id: 'u1', role: Role.PARTICIPANT }],
      ['a visitor', undefined],
    ])('does not compute any volunteer status for %s', async (_who, user) => {
      const findMany = vi.fn().mockResolvedValue(rows);
      const volunteerStatuses = vi.fn();

      const events = await (
        await build({ findMany }, { volunteerStatuses })
      ).findAll({}, user);

      expect(volunteerStatuses).not.toHaveBeenCalled();
      expect(events.every((event) => event.volunteerStatus === null)).toBe(
        true,
      );
    });

    it('gives the volunteer status on the event detail too', async () => {
      const findUnique = vi
        .fn()
        .mockResolvedValue({ ...rows[0], shifts: [openShift] });
      const volunteerStatuses = vi
        .fn()
        .mockResolvedValue(new Map([['e1', 'AVAILABLE']]));

      const event = await (
        await build({ findUnique }, { volunteerStatuses })
      ).findOne('e1', { id: 'u1', role: Role.VOLUNTEER });

      expect(event.volunteerStatus).toBe('AVAILABLE');
    });
  });

  it('throws 404 when the event does not exist', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      (await build({ findUnique })).findOne('missing'),
    ).rejects.toThrow(NotFoundException);
  });

  describe('volunteer coverage and organization filter', () => {
    const shift = (
      requiredVolunteers: number,
      assignments: number,
      endsAt = new Date(Date.now() + 86_400_000),
    ) => ({
      requiredVolunteers,
      endsAt,
      _count: { assignments },
    });

    it.each([
      ['an open shift', [shift(2, 1)], 'AVAILABLE'],
      ['no shift', [], null],
      ['only full shifts', [shift(2, 2)], null],
      ['only past shifts', [shift(2, 0, new Date(Date.now() - 1000))], null],
    ])(
      'shows "can join" only with a shift to join: %s',
      async (_c, shifts, expected) => {
        const findMany = vi.fn().mockResolvedValue([
          {
            id: 'e1',
            capacity: 10,
            _count: { tickets: 0 },
            organizations: [],
            shifts,
          },
        ]);
        const volunteerStatuses = vi
          .fn()
          .mockResolvedValue(new Map([['e1', 'AVAILABLE']]));

        const [event] = await (
          await build({ findMany }, { volunteerStatuses })
        ).findAll({}, { id: 'u1', role: Role.VOLUNTEER });

        expect(event.volunteerStatus).toBe(expected);
      },
    );

    it('keeps "already on a shift" even when no shift is left to join', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'e1',
          capacity: 10,
          _count: { tickets: 0 },
          organizations: [],
          shifts: [shift(1, 1)],
        },
      ]);
      const volunteerStatuses = vi
        .fn()
        .mockResolvedValue(new Map([['e1', 'ASSIGNED']]));

      const [event] = await (
        await build({ findMany }, { volunteerStatuses })
      ).findAll({}, { id: 'u1', role: Role.VOLUNTEER });

      expect(event.volunteerStatus).toBe('ASSIGNED');
    });

    it('sums what the shifts of an event still miss, without counting an overbooked shift negatively', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'e1',
          capacity: 10,
          _count: { tickets: 0 },
          organizations: [],
          shifts: [shift(3, 1), shift(2, 2), shift(2, 0)],
        },
      ]);

      const [event] = await (await build({ findMany })).findAll({});

      expect(event.volunteers).toEqual({
        required: 7,
        registered: 3,
        missing: 4,
      });
      expect(event).not.toHaveProperty('shifts');
    });

    it('filters on the organization when asked', async () => {
      const findMany = vi.fn().mockResolvedValue([]);

      await (await build({ findMany })).findAll({ organizationId: 'o1' });

      expect(findMany.mock.calls[0][0].where.organizations).toEqual({
        some: { organizationId: 'o1' },
      });
    });

    it('does not filter on organizations by default', async () => {
      const findMany = vi.fn().mockResolvedValue([]);

      await (await build({ findMany })).findAll({});

      expect(findMany.mock.calls[0][0].where).not.toHaveProperty(
        'organizations',
      );
    });
  });
});
