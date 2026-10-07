import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventCategory } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EventsService } from './events.service.js';

const dto = {
  title: 'Gala',
  description: 'Soirée de fin d’année',
  startsAt: new Date('2026-12-01T19:00:00Z'),
  endsAt: new Date('2026-12-01T23:00:00Z'),
  location: 'Nancy',
  capacity: 50,
  category: EventCategory.PARTY,
};

async function build(event: Record<string, ReturnType<typeof vi.fn>>) {
  const module = await Test.createTestingModule({
    providers: [EventsService, { provide: PrismaService, useValue: { event } }],
  }).compile();
  return module.get(EventsService);
}

describe('EventsService', () => {
  it('stores the logged in organizer as owner', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'e1' });
    await (await build({ create })).create(dto, 'org-1');

    expect(create).toHaveBeenCalledWith({
      data: { ...dto, organizerId: 'org-1' },
    });
  });

  it('rejects an event that ends before it starts', async () => {
    const create = vi.fn();
    const service = await build({ create });

    expect(() =>
      service.create({ ...dto, endsAt: dto.startsAt }, 'org-1'),
    ).toThrow(BadRequestException);
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
