import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CheckoutSession,
  NormalizedPaymentEvent,
  PaymentGateway,
} from './gateway.interface';
import { PLANS } from './plans';

const API = 'https://api.commerce.coinbase.com';

/**
 * Cryptocurrency via Coinbase Commerce hosted charges — the customer pays in
 * BTC, ETH, USDC, LTC, DOGE…; we price in USD and Coinbase handles conversion
 * and confirmation depth. No keys/wallets to custody ourselves.
 */
@Injectable()
export class CryptoService implements PaymentGateway {
  async createCheckout(
    farmId: string,
    plan: Plan,
    returnUrl: string,
  ): Promise<CheckoutSession> {
    const res = await fetch(`${API}/charges`, {
      method: 'POST',
      headers: {
        'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `PrimeAxis ${PLANS[plan].name}`,
        description: '1 month subscription',
        pricing_type: 'fixed_price',
        local_price: {
          amount: PLANS[plan].priceUsdMonthly.toFixed(2),
          currency: 'USD',
        },
        metadata: { farmId, plan },
        redirect_url: `${returnUrl}?status=success`,
        cancel_url: `${returnUrl}?status=cancelled`,
      }),
    });
    if (!res.ok) throw new Error(`Coinbase charge failed: ${await res.text()}`);
    const { data } = await res.json();
    return { url: data.hosted_url, externalRef: data.code };
  }

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedPaymentEvent | null> {
    // HMAC-SHA256 of the raw body, constant-time compared.
    const signature = String(headers['x-cc-webhook-signature'] ?? '');
    const expected = createHmac('sha256', process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Coinbase webhook signature verification failed');
    }

    const { event } = JSON.parse(rawBody.toString());
    const meta = event?.data?.metadata ?? {};
    if (!meta.farmId) return null;

    // charge:confirmed = funds received with enough confirmations.
    if (event.type === 'charge:confirmed') {
      return {
        kind: 'payment_succeeded',
        farmId: meta.farmId,
        plan: meta.plan as Plan,
        externalId: event.data.code,
        amount: Number(event.data.pricing?.local?.amount ?? 0),
        currency: event.data.pricing?.local?.currency,
        periodEnd: new Date(Date.now() + 31 * 86_400_000),
      };
    }
    if (event.type === 'charge:failed') {
      return {
        kind: 'payment_failed',
        farmId: meta.farmId,
        externalId: event.data.code,
      };
    }
    return null;
  }
}
