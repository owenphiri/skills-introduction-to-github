import { Injectable } from '@nestjs/common';
import { DailyRecord, Flock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FlockKpis {
  flockId: string;
  ageDays: number;
  birdsAlive: number;
  mortalityRatePct: number;
  livabilityPct: number;
  fcr: number | null;            // broilers
  adgGramsPerDay: number | null; // broilers
  avgWeightG: number | null;
  henDayPct: number | null;      // layers
  eggsToday: number | null;
  feedTodayKg: number;
  waterFeedRatio: number | null;
  trend: {
    /** last 14 days of the flock's primary series (weight or egg %) */
    series: { date: string; value: number }[];
    /** 7-day linear projection of that series */
    projected7d: number | null;
  };
}

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  /** All KPI math lives here — docs/architecture.md § KPI definitions. */
  async forFlock(flock: Flock): Promise<FlockKpis> {
    const records = await this.prisma.dailyRecord.findMany({
      where: { flockId: flock.id },
      orderBy: { date: 'asc' },
    });

    const totalDead = sum(records, (r) => r.mortality + r.culls);
    const birdsAlive = Math.max(flock.birdsPlaced - totalDead, 0);
    const mortalityRatePct = pct(totalDead, flock.birdsPlaced);
    const ageDays = Math.max(
      Math.floor((Date.now() - flock.placedAt.getTime()) / 86_400_000),
      1,
    );

    const latest = records.at(-1) ?? null;
    const totalFeedKg = sum(records, (r) => r.feedKg);

    // FCR = feed consumed / live weight gained (broilers with weight samples)
    let fcr: number | null = null;
    let adg: number | null = null;
    if (flock.type !== 'LAYER' && latest?.avgWeightG) {
      const gainPerBirdKg = (latest.avgWeightG - flock.dayOldWeightG) / 1000;
      const totalGainKg = gainPerBirdKg * birdsAlive;
      fcr = totalGainKg > 0 ? round(totalFeedKg / totalGainKg, 2) : null;
      adg = round((latest.avgWeightG - flock.dayOldWeightG) / ageDays, 1);
    }

    // Hen-day production % = eggs / hens alive that day (layers)
    let henDayPct: number | null = null;
    if (flock.type === 'LAYER' && latest) {
      henDayPct = pct(latest.eggsCollected, birdsAlive || 1);
    }

    const waterFeedRatio =
      latest && latest.feedKg > 0 && latest.waterL > 0
        ? round(latest.waterL / latest.feedKg, 2)
        : null;

    const primary = this.primarySeries(flock, records, birdsAlive);

    return {
      flockId: flock.id,
      ageDays,
      birdsAlive,
      mortalityRatePct,
      livabilityPct: round(100 - mortalityRatePct, 2),
      fcr,
      adgGramsPerDay: adg,
      avgWeightG: latest?.avgWeightG ?? null,
      henDayPct,
      eggsToday: flock.type === 'LAYER' ? (latest?.eggsCollected ?? 0) : null,
      feedTodayKg: latest?.feedKg ?? 0,
      waterFeedRatio,
      trend: {
        series: primary,
        projected7d: this.linearProjection(primary, 7),
      },
    };
  }

  /** Farm-level rollup for the dashboard header tiles. */
  async forFarm(farmId: string) {
    const flocks = await this.prisma.flock.findMany({
      where: { farmId, status: 'ACTIVE' },
    });
    const kpis = await Promise.all(flocks.map((f) => this.forFlock(f)));

    const placed = sum(flocks, (f) => f.birdsPlaced);
    const alive = sum(kpis, (k) => k.birdsAlive);
    const broilers = kpis.filter((k) => k.fcr !== null);
    const layers = kpis.filter((k) => k.henDayPct !== null);

    return {
      farmId,
      activeFlocks: flocks.length,
      birdsAlive: alive,
      mortalityRatePct: pct(placed - alive, placed || 1),
      avgFcr: broilers.length ? round(avg(broilers.map((k) => k.fcr!)), 2) : null,
      avgAdg: broilers.length
        ? round(avg(broilers.map((k) => k.adgGramsPerDay ?? 0)), 1)
        : null,
      henDayPct: layers.length
        ? round(avg(layers.map((k) => k.henDayPct!)), 1)
        : null,
      eggsToday: sum(layers, (k) => k.eggsToday ?? 0),
      feedTodayKg: round(sum(kpis, (k) => k.feedTodayKg), 1),
      flocks: kpis,
    };
  }

  // Weight curve for broilers, hen-day % for layers — the series charted on
  // the flock page and used for the 7-day projection.
  private primarySeries(
    flock: Flock,
    records: DailyRecord[],
    birdsAlive: number,
  ) {
    const tail = records.slice(-14);
    return tail
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        value:
          flock.type === 'LAYER'
            ? pct(r.eggsCollected, birdsAlive || 1)
            : (r.avgWeightG ?? NaN),
      }))
      .filter((p) => Number.isFinite(p.value));
  }

  /**
   * Least-squares fit over the recent series, projected `days` ahead.
   * Deliberately simple and explainable — see architecture.md.
   */
  private linearProjection(
    series: { value: number }[],
    days: number,
  ): number | null {
    const n = series.length;
    if (n < 5) return null;
    const xs = series.map((_, i) => i);
    const ys = series.map((p) => p.value);
    const xMean = avg(xs);
    const yMean = avg(ys);
    const slope =
      sum(xs, (x, i) => (x - xMean) * (ys[i] - yMean)) /
      (sum(xs, (x) => (x - xMean) ** 2) || 1);
    return round(yMean + slope * (n - 1 - xMean + days), 1);
  }
}

const sum = <T>(arr: T[], f: (t: T, i: number) => number) =>
  arr.reduce((acc, t, i) => acc + f(t, i), 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (part: number, whole: number) => round((part / (whole || 1)) * 100, 2);
const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
