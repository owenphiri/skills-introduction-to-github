import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';
import {
  CheckoutSession,
  NormalizedPaymentEvent,
  PaymentGateway,
} from './gateway.interface';
import { PLANS } from './plans';

const BASE =
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * PayPal Orders API (one-off monthly charge; swap to the Subscriptions API by
 * creating billing plans and using /v1/billing/subscriptions the same way).
 * Uses the REST API directly — the official SDK lags the API and adds weight.
 */
@Injectable()
export class PaypalService implements PaymentGateway {
  private async token(): Promise<string> {
    const res = await fetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
          ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
    return (await res.json()).access_token;
  }

  async createCheckout(
    farmId: string,
    plan: Plan,
    returnUrl: string,
  ): Promise<CheckoutSession> {
    const res = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: farmId,
            custom_id: `${farmId}:${plan}`,
            description: `PrimeAxis ${PLANS[plan].name} — 1 month`,
            amount: {
              currency_code: 'USD',
              value: PLANS[plan].priceUsdMonthly.toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${returnUrl}?status=success`,
              cancel_url: `${returnUrl}?status=cancelled`,
              user_action: 'PAY_NOW',
            },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`PayPal order failed: ${await res.text()}`);
    const order = await res.json();
    const approve = order.links.find(
      (l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve',
    );
    return { url: approve.href, externalRef: order.id };
  }

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedPaymentEvent | null> {
    const body = JSON.parse(rawBody.toString());

    // PayPal verification is an API round-trip, not an HMAC.
    const verifyRes = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: body,
      }),
    });
    const { verification_status } = await verifyRes.json();
    if (verification_status !== 'SUCCESS') {
      throw new Error('PayPal webhook signature verification failed');
    }

    if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = body.resource;
      const [farmId, plan] = String(capture.custom_id ?? ':').split(':');
      if (!farmId) return null;
      return {
        kind: 'payment_succeeded',
        farmId,
        plan: plan as Plan,
        externalId: capture.id,
        amount: Number(capture.amount?.value ?? 0),
        currency: capture.amount?.currency_code,
        periodEnd: new Date(Date.now() + 31 * 86_400_000),
      };
    }
    if (body.event_type === 'PAYMENT.CAPTURE.DENIED') {
      const [farmId] = String(body.resource?.custom_id ?? ':').split(':');
      if (!farmId) return null;
      return { kind: 'payment_failed', farmId, externalId: body.resource.id };
    }
    return null;
  }
}
