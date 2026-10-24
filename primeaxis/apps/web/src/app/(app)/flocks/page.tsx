'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { activeFarm, api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Flock {
  id: string;
  name: string;
  type: 'BROILER' | 'LAYER' | 'BREEDER';
  breed: string;
  birdsPlaced: number;
  placedAt: string;
  status: string;
  house: { name: string };
}

export default function FlocksPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);

  useEffect(() => setFarmId(activeFarm.get()), []);
  useEffect(() => {
    if (farmId) api.get<Flock[]>(`/farms/${farmId}/flocks`).then(setFlocks);
  }, [farmId]);

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Flocks & houses</h1>
        {/* Card list works on 360px; grid on desktop. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flocks.map((flock) => {
            const ageDays = Math.floor(
              (Date.now() - new Date(flock.placedAt).getTime()) / 86_400_000,
            );
            return (
              <Link key={flock.id} href={`/flocks/${flock.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{flock.name}</h3>
                    <Badge tone={flock.status === 'ACTIVE' ? 'good' : 'neutral'}>
                      {flock.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {flock.type} · {flock.breed} · {flock.house.name}
                  </p>
                  <p className="mt-2 text-sm">
                    {formatNumber(flock.birdsPlaced)} birds placed ·{' '}
                    <span className="text-muted-foreground">{ageDays} days old</span>
                  </p>
                </Card>
              </Link>
            );
          })}
          {flocks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No flocks yet — a manager can add one from this page.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
