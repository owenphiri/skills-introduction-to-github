import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUrl } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentsService } from './payments.service';

class CheckoutDto {
  @IsIn(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

  @IsIn(['STRIPE', 'PAYPAL', 'CRYPTO'])
  gateway: 'STRIPE' | 'PAYPAL' | 'CRYPTO';

  @IsString()
  @IsUrl({ require_tld: false }) // allow localhost in dev
  returnUrl: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Public: the pricing page reads this. */
  @Get('plans')
  plans() {
    return this.payments.plans();
  }

  /** Only owners can change a farm's plan. Returns { url } to redirect to. */
  @Post('farms/:farmId/checkout')
  @UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
  @Roles('OWNER')
  checkout(@Param('farmId') farmId: string, @Body() dto: CheckoutDto) {
    return this.payments.checkout(farmId, dto.plan, dto.gateway, dto.returnUrl);
  }
}
