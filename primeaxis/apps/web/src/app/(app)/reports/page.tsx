'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { useLiveKpis } from '@/hooks/use-live-kpis';
import { activeFarm, api } from '@/lib/api';
import { brand } from '@/lib/brand';
import { formatNumber } from '@/lib/utils';

interface FinanceSummary {
  perBatch: { flockId: string; name: string; revenue: number; costs: number; profit: number }[];
}

/** Shareable performance card + per-batch profitability table. */
export default function ReportsPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  useEffect(() => setFarmId(activeFarm.get()), []);

  const { kpis } = useLiveKpis(farmId);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  useEffect(() => {
    if (farmId)
      api.get<FinanceSummary>(`/farms/${farmId}/finance/summary`).then(setFinance).catch(() => {});
  }, [farmId]);

  async function share() {
    const text =
      `🐔 Farm performance (${brand.name})\n` +
      `Birds: ${formatNumber(kpis?.birdsAlive)} · Mortality: ${kpis?.mortalityRatePct}%\n` +
      (kpis?.avgFcr ? `FCR: ${kpis.avgFcr} · ` : '') +
      (kpis?.henDayPct ? `Egg production: ${kpis.henDayPct}%` : '');
    // Native share sheet on mobile (WhatsApp, X…); clipboard on desktop.
    if (navigator.share) await navigator.share({ title: 'Farm performance', text });
    else {
      await navigator.clipboard.writeText(text);
      alert('Report copied to clipboard');
    }
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Reports</h1>
          <Button size="sm" onClick={share}>
            <Share2 className="size-4" /> Share performance card
          </Button>
        </div>

        {finance && finance.perBatch.length > 0 && (
          <Card>
            <CardTitle>Profitability per batch</CardTitle>
            {/* Wide table scrolls inside its own container on small screens */}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 font-medium">Batch</th>
                    <th className="py-2 text-right font-medium">Revenue</th>
                    <th className="py-2 text-right font-medium">Costs</th>
                    <th className="py-2 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {finance.perBatch.map((b) => (
                    <tr key={b.flockId} className="border-b border-border/60">
                      <td className="py-2">{b.name}</td>
                      <td className="py-2 text-right">${formatNumber(b.revenue)}</td>
                      <td className="py-2 text-right">${formatNumber(b.costs)}</td>
                      <td className={`py-2 text-right font-medium ${b.profit >= 0 ? 'text-good' : 'text-critical'}`}>
                        {b.profit >= 0 ? '' : '−'}${formatNumber(Math.abs(b.profit))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!finance && (
          <p className="text-sm text-muted-foreground">
            Financial reports are visible to owners and managers.
          </p>
        )}
      </main>
    </>
  );
}
