import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SensorReadingDto, UpsertDailyRecordDto } from './dto/record.dto';
import { KpiService } from './kpi.service';

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpi: KpiService,
    private readonly alerts: AlertsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * The write path that drives the whole live dashboard:
   * upsert record → recompute KPIs → evaluate alerts → push over WS.
   */
  async upsert(
    farmId: string,
    flockId: string,
    userId: string,
    dto: UpsertDailyRecordDto,
  ) {
    const flock = await this.prisma.flock.findFirst({
      where: { id: flockId, farmId },
    });
    if (!flock) throw new NotFoundException('Flock not found');

    const record = await this.prisma.dailyRecord.upsert({
      where: { flockId_date: { flockId, date: dto.date } },
      create: { flockId, recordedById: userId, ...dto },
      update: { ...dto, recordedById: userId },
    });

    await this.alerts.evaluateRecord(farmId, flockId, flock.name, {
      mortality: record.mortality,
      feedKg: record.feedKg,
      waterL: record.waterL,
    });

    const farmKpis = await this.kpi.forFarm(farmId);
    this.realtime.emitToFarm(farmId, 'kpi:update', farmKpis);

    return record;
  }

  list(farmId: string, flockId: string, days = 60) {
    return this.prisma.dailyRecord.findMany({
      where: {
        flock: { id: flockId, farmId },
        date: { gte: new Date(Date.now() - days * 86_400_000) },
      },
      orderBy: { date: 'asc' },
    });
  }

  async flockKpis(farmId: string, flockId: string) {
    const flock = await this.prisma.flock.findFirst({
      where: { id: flockId, farmId },
    });
    if (!flock) throw new NotFoundException('Flock not found');
    return this.kpi.forFlock(flock);
  }

  farmKpis(farmId: string) {
    return this.kpi.forFarm(farmId);
  }

  async addSensorReading(farmId: string, dto: SensorReadingDto) {
    const house = await this.prisma.house.findFirst({
      where: { id: dto.houseId, farmId },
    });
    if (!house) throw new NotFoundException('House not found');

    const reading = await this.prisma.sensorReading.create({
      data: { houseId: house.id, tempC: dto.tempC, humidityPct: dto.humidityPct },
    });
    await this.alerts.evaluateSensor(farmId, house, reading);
    this.realtime.emitToFarm(farmId, 'sensor:new', {
      ...reading,
      houseName: house.name,
    });
    return reading;
  }
}
