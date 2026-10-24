import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SensorReadingDto, UpsertDailyRecordDto } from './dto/record.dto';
import { RecordsService } from './records.service';

@Controller('farms/:farmId')
@UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  /** Live dashboard seed — same shape the `kpi:update` WS event pushes. */
  @Get('kpis')
  farmKpis(@Param('farmId') farmId: string) {
    return this.records.farmKpis(farmId);
  }

  @Get('flocks/:flockId/kpis')
  flockKpis(@Param('farmId') farmId: string, @Param('flockId') flockId: string) {
    return this.records.flockKpis(farmId, flockId);
  }

  @Get('flocks/:flockId/records')
  list(
    @Param('farmId') farmId: string,
    @Param('flockId') flockId: string,
    @Query('days') days?: string,
  ) {
    return this.records.list(farmId, flockId, days ? Number(days) : undefined);
  }

  /** Workers CAN submit daily data — that's their job. PUT = idempotent upsert. */
  @Put('flocks/:flockId/records')
  upsert(
    @Param('farmId') farmId: string,
    @Param('flockId') flockId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertDailyRecordDto,
  ) {
    return this.records.upsert(farmId, flockId, user.id, dto);
  }

  @Post('sensor-readings')
  addSensorReading(@Param('farmId') farmId: string, @Body() dto: SensorReadingDto) {
    return this.records.addSensorReading(farmId, dto);
  }
}
