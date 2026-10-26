import { Test } from '@nestjs/testing';
import { EventCategory } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { PredictionService } from './prediction.service.js';

// Fixed dates: the season only depends on the month
const JULY = new Date('2025-07-10T18:00:00Z');
const JANUARY = new Date('2025-01-10T18:00:00Z');

const past = (
  category: EventCategory,
  capacity: number,
  reserved: number,
  startsAt = JULY,
) => ({ category, capacity, startsAt, _count: { tickets: reserved } });

async function build(events: ReturnType<typeof past>[]) {
  const findMany = vi.fn().mockResolvedValue(events);
  const module = await Test.createTestingModule({
    providers: [
      PredictionService,
      { provide: PrismaService, useValue: { event: { findMany } } },
    ],
  }).compile();
  return { service: module.get(PredictionService), findMany };
}

const input = (capacity = 100, category: EventCategory = 'PARTY') => ({
  category,
  startsAt: JULY,
  capacity,
});

describe('PredictionService', () => {
  it('scales the fill rate of a single identical past event to the new capacity', async () => {
    const { service } = await build([past('PARTY', 80, 40)]);

    const result = await service.predict(input(100));

    expect(result.estimate).toBe(50);
    expect(result.fillRate).toBe(0.5);
    expect(result.sampleSize).toBe(1);
    expect(result.warning).toBeNull();
  });

  it('only reads events that already happened', async () => {
    const { service, findMany } = await build([]);

    await service.predict(input());

    expect(findMany.mock.calls[0][0].where.startsAt.lt).toBeInstanceOf(Date);
  });

  it('counts only reserved tickets, not cancelled ones', async () => {
    const { service, findMany } = await build([past('PARTY', 100, 30)]);

    await service.predict(input());

    expect(
      findMany.mock.calls[0][0].select._count.select.tickets.where,
    ).toEqual({ status: 'RESERVED' });
  });

  it('weights an event of the same category above one of another category', async () => {
    // rates 0.8 (PARTY, weight 1) and 0.2 (SPORT, weight 0.1) => (0.8 + 0.02) / 1.1 = 0.75
    const { service } = await build([
      past('PARTY', 100, 80),
      past('SPORT', 100, 20),
    ]);

    expect((await service.predict(input())).estimate).toBe(75);
  });

  it('ignores the other categories once the category has enough history', async () => {
    // three PARTY events (weight 3 >= 1.5) at 0.8: the empty SPORT events must not drag the estimate down
    const { service } = await build([
      past('PARTY', 100, 80),
      past('PARTY', 100, 80),
      past('PARTY', 100, 80),
      past('SPORT', 100, 0),
      past('SPORT', 100, 0),
    ]);

    expect((await service.predict(input())).estimate).toBe(80);
  });

  it('weights a close season above the opposite one', async () => {
    // Same category and capacity, rates 0.8 in July and 0.2 in January: asking for July leans to 0.8
    const { service } = await build([
      past('PARTY', 100, 80, JULY),
      past('PARTY', 100, 20, JANUARY),
    ]);

    // (0.8 * 1 + 0.2 * 0.25) / 1.25 = 0.68
    expect((await service.predict(input())).estimate).toBe(68);
  });

  it('weights a similar capacity above a very different one', async () => {
    // weights 1 (100 vs 100) and 0.1 (10 vs 100): (0.5 + 0.09) / 1.1 = 0.54
    const { service } = await build([
      past('PARTY', 100, 50),
      past('PARTY', 10, 9),
    ]);

    expect((await service.predict(input())).fillRate).toBe(0.54);
  });

  it('warns of an overbooking risk when consistent similar events nearly sold out', async () => {
    const { service } = await build([
      past('PARTY', 100, 95),
      past('PARTY', 100, 96),
      past('PARTY', 100, 94),
    ]);

    const { warning } = await service.predict(input());

    expect(warning?.type).toBe('OVERBOOKING_RISK');
    expect(warning?.message).toContain('95 %');
  });

  it('warns of an underbooking risk when consistent similar events stayed empty', async () => {
    const { service } = await build([
      past('PARTY', 100, 15),
      past('PARTY', 100, 14),
      past('PARTY', 100, 16),
    ]);

    expect((await service.predict(input())).warning?.type).toBe(
      'UNDERBOOKING_RISK',
    );
  });

  it('gives no advice on a single event, however full it was', async () => {
    const { service } = await build([past('PARTY', 100, 95)]);

    const result = await service.predict(input());

    expect(result.confidence).toBe('LOW');
    expect(result.warning).toBeNull();
  });

  it('gives no advice when similar events disagree', async () => {
    const { service } = await build([
      past('PARTY', 100, 100),
      past('PARTY', 100, 100),
      past('PARTY', 100, 100),
      past('PARTY', 100, 5),
      past('PARTY', 100, 5),
      past('PARTY', 100, 5),
    ]);

    expect((await service.predict(input())).warning).toBeNull();
  });

  it('counts only the events of the requested category in the sample size', async () => {
    const { service } = await build([
      past('PARTY', 100, 60),
      past('SPORT', 100, 60),
      past('CULTURE', 100, 60),
    ]);

    expect((await service.predict(input())).sampleSize).toBe(1);
  });

  it('reads the season in UTC, whatever the time zone of the server', async () => {
    // 2025-12-01 00:30 Paris is still November (autumn) in UTC: it must weigh like the autumn event
    const { service } = await build([
      past('PARTY', 100, 80, new Date('2025-11-15T12:00:00Z')),
      past('PARTY', 100, 20, JULY),
    ]);

    const result = await service.predict({
      category: 'PARTY',
      startsAt: new Date('2025-11-30T23:30:00Z'),
      capacity: 100,
    });

    // autumn weight 1 and summer weight 0.5: (0.8 + 0.1) / 1.5 = 0.6
    expect(result.fillRate).toBe(0.6);
  });

  it('only reads the last years of history', async () => {
    const { service, findMany } = await build([]);

    await service.predict(input());

    const { gte, lt } = findMany.mock.calls[0][0].where.startsAt;
    expect(lt - gte).toBeGreaterThan(3 * 364 * 24 * 3600 * 1000);
    expect(lt - gte).toBeLessThan(3 * 367 * 24 * 3600 * 1000);
  });

  it('gives a low confidence on a single similar event', async () => {
    const { service } = await build([past('PARTY', 100, 60)]);

    expect((await service.predict(input())).confidence).toBe('LOW');
  });

  it('gives a high confidence on several consistent similar events', async () => {
    const { service } = await build([
      past('PARTY', 100, 60),
      past('PARTY', 100, 62),
      past('PARTY', 100, 58),
    ]);

    expect((await service.predict(input())).confidence).toBe('HIGH');
  });

  it('keeps a low confidence when similar events disagree', async () => {
    const { service } = await build([
      past('PARTY', 100, 100),
      past('PARTY', 100, 10),
      past('PARTY', 100, 100),
      past('PARTY', 100, 10),
    ]);

    expect((await service.predict(input())).confidence).toBe('LOW');
  });

  it('answers without an estimate when there is no history', async () => {
    const { service } = await build([]);

    expect(await service.predict(input())).toEqual({
      estimate: null,
      fillRate: null,
      confidence: 'LOW',
      sampleSize: 0,
      warning: null,
    });
  });
});
