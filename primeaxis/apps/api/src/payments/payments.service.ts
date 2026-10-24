import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayKind, Plan } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import { NormalizedPaymentEvent, PaymentGateway } from './gateway.interface';
import { PaypalService } from './paypal.service';
import { PLANS } from './plans';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gateways: Record<string, PaymentGateway>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    stripe: StripeService,
    paypal: PaypalService,
    crypto: CryptoService,
  ) {
    // Register a mobile-money gateway here to extend (see gateway.interface.ts)
    this.gateways = { STRIPE: stripe, PAYPAL: paypal, CRYPTO: crypto };
  }

  plans() {
    return PLANS;
  }

  async checkout(
    farmId: string,
    plan: Plan,
    gateway: PaymentGatewayKind,
    returnUrl: string,
  ) {
    if (plan === 'FREE') throw new BadRequestException('FREE needs no checkout');
    const impl = this.gateways[gateway];
    if (!impl) throw new BadRequestException(`Unknown gateway ${gateway}`);
    return impl.createCheckout(farmId, plan, returnUrl);
  }

  /** Shared webhook sink — all three controllers normalize into here. */
  async handleWebhook(
    gateway: PaymentGatewayKind,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const event = await this.gateways[gateway].parseWebhook(rawBody, headers);
    if (!event) return { received: true };
    await this.apply(gateway, event);
    return { received: true };
  }

  private async apply(gateway: PaymentGatewayKind, e: NormalizedPaymentEvent) {
    const sub = await this.prisma.subscription.findUnique({
      where: { farmId: e.farmId },
    });
    if (!sub) {
      this.logger.warn(`webhook for unknown farm ${e.farmId}`);
      return;
    }

    switch (e.kind) {
      case 'payment_succeeded':
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { farmId: e.farmId },
            data: {
              plan: e.plan ?? sub.plan,
              status: 'ACTIVE',
              gateway,
              currentPeriodEnd: e.periodEnd,
            },
          }),
          // upsert on the unique externalId = idempotent under replays
          this.prisma.payment.upsert({
            where: { externalId: e.externalId },
            create: {
              subscriptionId: sub.id,
              gateway,
              externalId: e.externalId,
              amount: e.amount ?? 0,
              currency: e.currency ?? 'USD',
              status: 'COMPLETED',
            },
            update: { status: 'COMPLETED' },
          }),
        ]);
        break;

      case 'payment_failed':
        await this.prisma.subscription.update({
          where: { farmId: e.farmId },
          data: { status: 'PAST_DUE' },
        });
        await this.alerts.raise(
          e.farmId,
          'PAYMENT',
          'WARNING',
          'A subscription payment failed — please update your payment method.',
        );
        break;

      case 'subscription_cancelled':
        await this.prisma.subscription.update({
          where: { farmId: e.farmId },
          data: { status: 'CANCELLED', plan: 'FREE' },
        });
        break;
    }
  }
}
