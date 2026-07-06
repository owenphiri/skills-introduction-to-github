import { Plan } from '@prisma/client';

/**
 * Every payment provider implements this. Adding a mobile-money gateway
 * (MTN MoMo, Airtel Money, M-Pesa…) = one class implementing PaymentGateway,
 * registered in payments.module.ts, plus a webhook route — nothing else changes.
 */
export interface CheckoutSession {
  /** Where to send the user to complete payment. */
  url: string;
  /** Provider-side reference to reconcile in the webhook. */
  externalRef: string;
}

export interface PaymentGateway {
  /** Start a subscription/checkout for a farm and plan. */
  createCheckout(farmId: string, plan: Plan, returnUrl: string): Promise<CheckoutSession>;

  /**
   * Verify a webhook's authenticity from the RAW body + headers and return
   * a normalized event, or null if the event type is irrelevant.
   */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedPaymentEvent | null>;
}

export interface NormalizedPaymentEvent {
  kind: 'payment_succeeded' | 'payment_failed' | 'subscription_cancelled';
  farmId: string;
  plan?: Plan;
  externalId: string; // idempotency key (Payment.externalId @unique)
  amount?: number;
  currency?: string;
  periodEnd?: Date;
}
