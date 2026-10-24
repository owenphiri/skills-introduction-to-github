import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinanceService, TxnDto } from './finance.service';

/** Financials are owner/manager only — workers never see money. */
@Controller('farms/:farmId/finance')
@UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@Param('farmId') farmId: string, @Query('months') months?: string) {
    return this.finance.summary(farmId, months ? Number(months) : undefined);
  }

  @Post('expenses')
  addExpense(@Param('farmId') farmId: string, @Body() dto: TxnDto) {
    return this.finance.addExpense(farmId, dto);
  }

  @Post('sales')
  addSale(@Param('farmId') farmId: string, @Body() dto: TxnDto) {
    return this.finance.addSale(farmId, dto);
  }
}
