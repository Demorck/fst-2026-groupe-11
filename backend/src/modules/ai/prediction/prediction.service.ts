import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@/generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  AttendancePredictionDto,
  AttendancePredictionResponseDto,
} from '../dto/attendance-prediction.dto.js';

// Older events say little about today's audience, and the query stays bounded as the history grows
const HISTORY_YEARS = 3;
// Weight of a past event of another category: kept low but non-zero so a rare category still gets an estimate
const OTHER_CATEGORY_WEIGHT = 0.1;
const OVERBOOKING_RATE = 0.85;
const UNDERBOOKING_RATE = 0.4;
// Total similarity weight needed for MEDIUM and HIGH confidence (1 = one identical past event)
const MEDIUM_WEIGHT = 1.5;
const HIGH_WEIGHT = 3;
// Past fill rates that disagree more than this (weighted standard deviation) cap the confidence at LOW
const MAX_SPREAD = 0.25;

// Winter wraps around the year end: Dec-Feb, Mar-May, Jun-Aug, Sep-Nov.
// UTC, so the same event lands in the same season whatever the time zone of the server.
const season = (date: Date) => Math.floor(((date.getUTCMonth() + 1) % 12) / 3);

const seasonWeight = (a: Date, b: Date) => {
  const gap = Math.abs(season(a) - season(b));
  return [1, 0.5, 0.25][Math.min(gap, 4 - gap)];
};

@Injectable()
export class PredictionService {
  constructor(private readonly prisma: PrismaService) {}

  async predict({
    category,
    startsAt,
    capacity,
  }: AttendancePredictionDto): Promise<AttendancePredictionResponseDto> {
    const now = new Date();
    const since = new Date(now);
    since.setUTCFullYear(since.getUTCFullYear() - HISTORY_YEARS);
    const past = await this.prisma.event.findMany({
      where: { startsAt: { lt: now, gte: since } },
      select: {
        category: true,
        capacity: true,
        startsAt: true,
        _count: {
          select: { tickets: { where: { status: TicketStatus.RESERVED } } },
        },
      },
    });
    if (past.length === 0) {
      return {
        estimate: null,
        fillRate: null,
        confidence: 'LOW',
        sampleSize: 0,
        warning: null,
      };
    }

    const weigh = (
      events: typeof past,
      categoryWeight: (other: boolean) => number,
    ) =>
      events.map((event) => ({
        rate: event._count.tickets / event.capacity,
        weight:
          categoryWeight(event.category !== category) *
          seasonWeight(event.startsAt, startsAt) *
          (Math.min(event.capacity, capacity) /
            Math.max(event.capacity, capacity)),
      }));
    const sameCategory = past.filter((event) => event.category === category);
    const sameWeight = weigh(sameCategory, () => 1).reduce(
      (sum, { weight }) => sum + weight,
      0,
    );
    // Enough similar events: the others would only pull the estimate towards the overall average
    const samples =
      sameWeight >= MEDIUM_WEIGHT
        ? weigh(sameCategory, () => 1)
        : weigh(past, (other) => (other ? OTHER_CATEGORY_WEIGHT : 1));
    const totalWeight = samples.reduce((sum, { weight }) => sum + weight, 0);
    const rate =
      samples.reduce((sum, s) => sum + s.rate * s.weight, 0) / totalWeight;
    const spread = Math.sqrt(
      samples.reduce((sum, s) => sum + s.weight * (s.rate - rate) ** 2, 0) /
        totalWeight,
    );
    const confidence = this.confidence(totalWeight, spread);

    return {
      estimate: Math.round(rate * capacity),
      fillRate: Math.round(rate * 100) / 100,
      confidence,
      // Only events of the same category: the others just stabilise the estimate
      sampleSize: sameCategory.length,
      // Advising a capacity change on thin or contradictory history would be guesswork
      warning: confidence === 'LOW' ? null : this.warning(rate),
    };
  }

  private confidence(totalWeight: number, spread: number) {
    if (spread > MAX_SPREAD || totalWeight < MEDIUM_WEIGHT) return 'LOW';
    return totalWeight >= HIGH_WEIGHT ? 'HIGH' : 'MEDIUM';
  }

  private warning(rate: number) {
    const percent = Math.round(rate * 100);
    if (rate >= OVERBOOKING_RATE) {
      return {
        type: 'OVERBOOKING_RISK' as const,
        message: `Les événements similaires affichent presque complet (${percent} % de remplissage) : envisagez d'augmenter la capacité.`,
      };
    }
    if (rate <= UNDERBOOKING_RATE) {
      return {
        type: 'UNDERBOOKING_RISK' as const,
        message: `Les événements similaires se remplissent peu (${percent} % de remplissage) : envisagez une capacité plus petite.`,
      };
    }
    return null;
  }
}
