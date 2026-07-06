import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_ORDER } from '../../payments/plans';

export const MIN_PLAN_KEY = 'minPlan';
/** Gate a route behind a plan tier, e.g. @MinPlan('PROFESSIONAL'). */
export const MinPlan = (plan: Plan) => SetMetadata(MIN_PLAN_KEY, plan);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const min = this.reflector.getAllAndOverride<Plan>(MIN_PLAN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!min) return true;

    const req = ctx.switchToHttp().getRequest();
    const sub = await this.prisma.subscription.findUnique({
      where: { farmId: req.params.farmId },
    });
    const plan: Plan = sub?.status === 'ACTIVE' || sub?.status === 'TRIALING'
      ? sub.plan
      : 'FREE';

    if (PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(min)) {
      // 402 tells the client exactly what to render: the upgrade dialog.
      throw new HttpException(
        `This feature requires the ${min} plan`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
