import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckoutSession,
  NormalizedPaymentEvent,
  PaymentGateway,
} from './gateway.interface';
import { STRIPE_PRICE_ENV } from './plans';

/** Cards (Visa / Mastercard / Amex) via Stripe Checkout subscriptions. */
@Injectable()
export class StripeService implements PaymentGateway {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

  constructor(private readonly prisma: PrismaService) {}

  async createCheckout(
    farmId: string,
    plan: Plan,
    returnUrl: string,
  ): Promise<CheckoutSession> {
    const priceEnv = STRIPE_PRICE_ENV[plan];
    if (!priceEnv || !process.env[priceEnv]) {
      throw new Error(`No Stripe price configured for plan ${plan}`);
    }

    // Reuse the farm's Stripe customer across upgrades/downgrades.
    const sub = await this.prisma.subscription.findUnique({ where: { farmId } });
    let customerId = sub?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { farmId },
      });
      customerId = customer.id;
      await this.prisma.subscription.update({
        where: { farmId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env[priceEnv]!, quantity: 1 }],
      success_url: `${returnUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?status=cancelled`,
      // metadata flows through to webhook events — this is how we know
      // which farm and plan a payment belongs to.
      subscription_data: { metadata: { farmId, plan } },
      metadata: { farmId, plan },
    });

    return { url: session.url!, externalRef: session.id };
  }

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedPaymentEvent | null> {
    // Signature check FIRST — an unverifiable payload is discarded untouched.
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      headers['stripe-signature'] as string,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const meta = subscriptionMetadata(invoice);
        if (!meta.farmId) return null;
        return {
          kind: 'payment_succeeded',
          farmId: meta.farmId,
          plan: meta.plan as Plan,
          externalId: event.id,
          amount: (invoice.amount_paid ?? 0) / 100,
          currency: invoice.currency?.toUpperCase(),
          periodEnd: invoice.lines?.data[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : undefined,
        };
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const meta = subscriptionMetadata(invoice);
        if (!meta.farmId) return null;
        return {
          kind: 'payment_failed',
          farmId: meta.farmId,
          externalId: event.id,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        if (!sub.metadata?.farmId) return null;
        return {
          kind: 'subscription_cancelled',
          farmId: sub.metadata.farmId,
          externalId: event.id,
        };
      }
      default:
        return null;
    }
  }
}

/**
 * The farmId/plan metadata set on subscription_data at checkout. Its location
 * on Invoice moved between Stripe API versions (subscription_details → parent),
 * so read both shapes.
 */
function subscriptionMetadata(invoice: Stripe.Invoice): Record<string, string> {
  const modern = (
    invoice as unknown as {
      parent?: { subscription_details?: { metadata?: Record<string, string> } };
    }
  ).parent?.subscription_details?.metadata;
  return modern ?? invoice.subscription_details?.metadata ?? {};
}
