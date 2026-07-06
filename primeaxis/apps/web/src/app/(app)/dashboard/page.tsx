'use client';

import { useEffect, useState } from 'react';
import { AlertsFeed } from '@/components/dashboard/alerts-feed';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ProductionChart } from '@/components/dashboard/production-chart';
import { RevenueCostChart } from '@/components/dashboard/revenue-cost-chart';
import { Topbar } from '@/components/layout/topbar';
import { useLiveKpis } from '@/hooks/use-live-kpis';
import { activeFarm, api, ApiError } from '@/lib/api';

interface FinanceSummary {
  monthly: { month: string; revenue: number; costs: number; profit: number }[];
}

export default function DashboardPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  useEffect(() => setFarmId(activeFarm.get()), []);

  const { kpis, alerts, connected, dismissAlert } = useLiveKpis(farmId);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeLocked, setFinanceLocked] = useState(false);

  useEffect(() => {
    if (!farmId) return;
    api
      .get<FinanceSummary>(`/farms/${farmId}/finance/summary`)
      .then(setFinance)
      // Workers get 403 on finance — hide the money chart, not the page.
      .catch((e) => e instanceof ApiError && setFinanceLocked(true));
  }, [farmId]);

  // The primary trend of the first flock with data drives the hero chart.
  const trendFlock = kpis?.flocks.find((f) => f.trend.series.length > 0);
  const isLayerTrend = trendFlock?.henDayPct != null;

  return (
    <>
      <Topbar live={connected} />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Farm overview</h1>

        {/* KPI tiles — real-time via useLiveKpis */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard title="Birds alive" value={kpis?.birdsAlive} />
          <KpiCard title="Mortality rate" value={kpis?.mortalityRatePct} unit="%" dp={2} />
          <KpiCard title="Feed conversion (FCR)" value={kpis?.avgFcr} dp={2} />
          <KpiCard title="Avg daily gain" value={kpis?.avgAdg} unit="g/day" dp={1} />
          <KpiCard title="Egg production" value={kpis?.henDayPct} unit="%" dp={1} deltaGoodWhen="up" />
          <KpiCard title="Eggs today" value={kpis?.eggsToday} />
          <KpiCard title="Feed today" value={kpis?.feedTodayKg} unit="kg" dp={1} />
          <KpiCard title="Active flocks" value={kpis?.activeFlocks} />
        </div>

        {/* Charts — one measure per axis, palette from chart-theme */}
        <div className="grid gap-4 lg:grid-cols-2">
          {trendFlock && (
            <ProductionChart
              title={isLayerTrend ? 'Hen-day egg production' : 'Average bird weight'}
              unit={isLayerTrend ? '%' : 'g'}
              data={trendFlock.trend.series}
              projected7d={trendFlock.trend.projected7d}
            />
          )}
          {finance && finance.monthly.length > 0 && (
            <RevenueCostChart data={finance.monthly} currency="$" />
          )}
          {financeLocked && (
            <p className="self-center rounded-card border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
              Financial charts are visible to owners and managers.
            </p>
          )}
        </div>

        <AlertsFeed alerts={alerts} onDismiss={dismissAlert} />
      </main>
    </>
  );
}
