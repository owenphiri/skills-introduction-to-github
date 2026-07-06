import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertKind, AlertSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  list(farmId: string, unreadOnly = false) {
    return this.prisma.alert.findMany({
      where: { farmId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  markRead(farmId: string, alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId, farmId },
      data: { readAt: new Date() },
    });
  }

  /** Persist + push. Every alert path in the system funnels through here. */
  async raise(
    farmId: string,
    kind: AlertKind,
    severity: AlertSeverity,
    message: string,
    entityId?: string,
  ) {
    // Debounce: skip if an identical unread alert already exists.
    const dupe = await this.prisma.alert.findFirst({
      where: { farmId, kind, entityId: entityId ?? null, readAt: null },
    });
    if (dupe) return dupe;

    const alert = await this.prisma.alert.create({
      data: { farmId, kind, severity, message, entityId },
    });
    this.realtime.emitToFarm(farmId, 'alert:new', alert);
    return alert;
  }

  /**
   * Threshold checks on a freshly written daily record.
   * Mortality spike rule: today's deaths > 3× the 7-day average (min 5 birds).
   */
  async evaluateRecord(
    farmId: string,
    flockId: string,
    flockName: string,
    today: { mortality: number; feedKg: number; waterL: number },
  ) {
    const last7 = await this.prisma.dailyRecord.findMany({
      where: { flockId },
      orderBy: { date: 'desc' },
      take: 8,
      skip: 1, // exclude today
    });
    const avgMortality =
      last7.length > 0
        ? last7.reduce((a, r) => a + r.mortality, 0) / last7.length
        : 0;

    if (today.mortality >= 5 && today.mortality > 3 * Math.max(avgMortality, 1)) {
      await this.raise(
        farmId,
        'MORTALITY_SPIKE',
        'CRITICAL',
        `${flockName}: ${today.mortality} deaths today vs ~${avgMortality.toFixed(1)}/day average — possible disease event`,
        flockId,
      );
    }

    if (today.feedKg > 0 && today.waterL > 0) {
      const ratio = today.waterL / today.feedKg;
      if (ratio < 1.6 || ratio > 2.2) {
        await this.raise(
          farmId,
          'WATER_FEED_RATIO',
          'WARNING',
          `${flockName}: water:feed ratio ${ratio.toFixed(2)} outside healthy 1.6–2.2 band`,
          flockId,
        );
      }
    }
  }

  async evaluateSensor(
    farmId: string,
    house: { id: string; name: string; tempMinC: number; tempMaxC: number; humidityMaxPct: number },
    reading: { tempC?: number | null; humidityPct?: number | null },
  ) {
    if (reading.tempC != null && (reading.tempC < house.tempMinC || reading.tempC > house.tempMaxC)) {
      await this.raise(
        farmId,
        'TEMPERATURE',
        'CRITICAL',
        `${house.name}: ${reading.tempC}°C outside ${house.tempMinC}–${house.tempMaxC}°C target`,
        house.id,
      );
    }
    if (reading.humidityPct != null && reading.humidityPct > house.humidityMaxPct) {
      await this.raise(
        farmId,
        'HUMIDITY',
        'WARNING',
        `${house.name}: humidity ${reading.humidityPct}% above ${house.humidityMaxPct}% max`,
        house.id,
      );
    }
  }

  /** Daily sweep: vaccinations due tomorrow or overdue. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async vaccinationSweep() {
    const due = await this.prisma.vaccination.findMany({
      where: {
        givenAt: null,
        dueDate: { lte: new Date(Date.now() + 86_400_000) },
      },
      include: { flock: { select: { farmId: true, name: true } } },
    });
    for (const v of due) {
      await this.raise(
        v.flock.farmId,
        'VACCINATION_DUE',
        'WARNING',
        `${v.flock.name}: "${v.vaccine}" due ${v.dueDate.toISOString().slice(0, 10)}`,
        v.id,
      );
    }
  }
}
