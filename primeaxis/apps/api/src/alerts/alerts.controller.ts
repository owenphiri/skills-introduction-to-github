import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';

@Controller('farms/:farmId/alerts')
@UseGuards(JwtAuthGuard, FarmAccessGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Param('farmId') farmId: string, @Query('unread') unread?: string) {
    return this.alerts.list(farmId, unread === 'true');
  }

  @Patch(':alertId/read')
  markRead(@Param('farmId') farmId: string, @Param('alertId') alertId: string) {
    return this.alerts.markRead(farmId, alertId);
  }
}
