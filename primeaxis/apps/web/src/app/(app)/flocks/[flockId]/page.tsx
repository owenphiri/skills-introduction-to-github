'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ProductionChart } from '@/components/dashboard/production-chart';
import { DailyRecordForm } from '@/components/flocks/daily-record-form';
import { Topbar } from '@/components/layout/topbar';
import { activeFarm, api } from '@/lib/api';

interface FlockDetail {
  id: string;
  name: string;
  type: 'BROILER' | 'LAYER' | 'BREEDER';
  breed: string;
  house: { name: string };
  vaccinations: { id: string; vaccine: string; dueDate: string; givenAt: string | null }[];
}

interface FlockKpis {
  ageDays: number;
  birdsAlive: number;
  mortalityRatePct: number;
  fcr: number | null;
  adgGramsPerDay: number | null;
  henDayPct: number | null;
  waterFeedRatio: number | null;
  trend: { series: { date: string; value: number }[]; projected7d: number | null };
}

export default function FlockDetailPage() {
  const { flockId } = useParams<{ flockId: string }>();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [flock, setFlock] = useState<FlockDetail | null>(null);
  const [kpis, setKpis] = useState<FlockKpis | null>(null);

  useEffect(() => setFarmId(activeFarm.get()), []);

  const reload = useCallback(() => {
    if (!farmId) return;
    api.get<FlockDetail>(`/farms/${farmId}/flocks/${flockId}`).then(setFlock);
    api.get<FlockKpis>(`/farms/${farmId}/flocks/${flockId}/kpis`).then(setKpis);
  }, [farmId, flockId]);

  useEffect(reload, [reload]);

  if (!farmId || !flock) return <Topbar />;
  const isLayer = flock.type === 'LAYER';

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div>
          <h1 className="text-lg font-semibold">{flock.name}</h1>
          <p className="text-sm text-muted-foreground">
            {flock.type} · {flock.breed} · {flock.house.name}
            {kpis && ` · day ${kpis.ageDays}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard title="Birds alive" value={kpis?.birdsAlive} />
          <KpiCard title="Mortality" value={kpis?.mortalityRatePct} unit="%" dp={2} />
          {isLayer ? (
            <KpiCard title="Hen-day production" value={kpis?.henDayPct} unit="%" dp={1} deltaGoodWhen="up" />
          ) : (
            <KpiCard title="FCR" value={kpis?.fcr} dp={2} />
          )}
          <KpiCard title="Water : feed" value={kpis?.waterFeedRatio} dp={2} />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <DailyRecordForm
            farmId={farmId}
            flockId={flock.id}
            flockType={flock.type}
            onSaved={reload}
          />
          {kpis && kpis.trend.series.length > 0 && (
            <ProductionChart
              title={isLayer ? 'Hen-day egg production' : 'Average bird weight'}
              unit={isLayer ? '%' : 'g'}
              data={kpis.trend.series}
              projected7d={kpis.trend.projected7d}
            />
          )}
        </div>

        {flock.vaccinations.length > 0 && (
          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Vaccination schedule</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {flock.vaccinations.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span>{v.vaccine}</span>
                  <span className="text-muted-foreground">
                    {v.givenAt
                      ? `given ${v.givenAt.slice(0, 10)} ✓`
                      : `due ${v.dueDate.slice(0, 10)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
