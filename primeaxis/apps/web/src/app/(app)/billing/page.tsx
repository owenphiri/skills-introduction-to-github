'use client';

import { useEffect, useState } from 'react';
import { Bitcoin, CreditCard } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { activeFarm, api } from '@/lib/api';
import { PLANS, type PlanId } from '@/lib/plans';

type Gateway = 'STRIPE' | 'PAYPAL' | 'CRYPTO';

interface FarmInfo {
  subscription: { plan: PlanId; status: string } | null;
}

/** Billing: pick a plan, pick a gateway, get redirected to hosted checkout. */
export default function BillingPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [current, setCurrent] = useState<PlanId>('FREE');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFarmId(activeFarm.get()), []);
  useEffect(() => {
    if (farmId)
      api.get<FarmInfo>(`/farms/${farmId}`).then((f) =>
        setCurrent(f.subscription?.plan ?? 'FREE'),
      );
  }, [farmId]);

  async function checkout(plan: PlanId, gateway: Gateway) {
    if (!farmId || plan === 'FREE') return;
    setBusy(`${plan}:${gateway}`);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>(`/farms/${farmId}/checkout`, {
        plan,
        gateway,
        returnUrl: `${window.location.origin}/billing`,
      });
      window.location.href = url; // hosted checkout (Stripe/PayPal/Coinbase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setBusy(null);
    }
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Billing & plans</h1>
        {error && <p className="text-sm text-critical">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === current;
            return (
              <Card key={plan.id} className={isCurrent ? 'border-primary' : ''}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {isCurrent && <Badge tone="brand">Current</Badge>}
                </div>
                <p className="mt-1 text-3xl font-bold">
                  ${plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {plan.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>

                {!isCurrent && plan.id !== 'FREE' && (
                  <div className="mt-4 space-y-2">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={busy !== null}
                      onClick={() => checkout(plan.id, 'STRIPE')}
                    >
                      <CreditCard className="size-4" />
                      {busy === `${plan.id}:STRIPE` ? 'Redirecting…' : 'Card (Stripe)'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={busy !== null}
                      onClick={() => checkout(plan.id, 'PAYPAL')}
                    >
                      {busy === `${plan.id}:PAYPAL` ? 'Redirecting…' : 'PayPal'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={busy !== null}
                      onClick={() => checkout(plan.id, 'CRYPTO')}
                    >
                      <Bitcoin className="size-4" />
                      {busy === `${plan.id}:CRYPTO` ? 'Redirecting…' : 'Crypto (BTC/ETH/USDC)'}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-faint-foreground">
          Payments are processed by Stripe, PayPal and Coinbase Commerce — card and
          wallet details never touch our servers. Mobile-money support is on the
          roadmap (the payment layer is gateway-pluggable).
        </p>
      </main>
    </>
  );
}
