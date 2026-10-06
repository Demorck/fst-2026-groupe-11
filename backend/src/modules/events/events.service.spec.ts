import { BadRequestException } from '@nestjs/common';
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

async function build(create: ReturnType<typeof vi.fn>) {
  const module = await Test.createTestingModule({
    providers: [
      EventsService,
      { provide: PrismaService, useValue: { event: { create } } },
    ],
  }).compile();
  return module.get(EventsService);
}

describe('EventsService', () => {
  it('stores the logged in organizer as owner', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'e1' });
    await (await build(create)).create(dto, 'org-1');

    expect(create).toHaveBeenCalledWith({
      data: { ...dto, organizerId: 'org-1' },
    });
  });

  it('rejects an event that ends before it starts', async () => {
    const create = vi.fn();
    const service = await build(create);

    expect(() =>
      service.create({ ...dto, endsAt: dto.startsAt }, 'org-1'),
    ).toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
