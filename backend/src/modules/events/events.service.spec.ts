import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventCategory } from '../../generated/prisma/enums.js';
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
  assertManagesAll = vi.fn().mockResolvedValue(undefined),
) {
  const module = await Test.createTestingModule({
    providers: [
      EventsService,
      { provide: PrismaService, useValue: { event } },
      { provide: OrganizationsService, useValue: { assertManagesAll } },
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
      (await build({ create }, assertManagesAll)).create(dto, 'user-1'),
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
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'e1', capacity: 50, _count: { tickets: 12 } }]);
    const from = new Date('2026-12-01');

    const events = await (
      await build({ findMany })
    ).findAll({ from, category: EventCategory.PARTY });

    expect(events).toEqual([{ id: 'e1', capacity: 50, remainingSeats: 38 }]);
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
      _count: { tickets: 50 },
    });

    await expect((await build({ findUnique })).findOne('e1')).resolves.toEqual({
      id: 'e1',
      capacity: 50,
      organizer: { id: 'org-1', name: 'Asso' },
      remainingSeats: 0,
    });
  });

  it('throws 404 when the event does not exist', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      (await build({ findUnique })).findOne('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
