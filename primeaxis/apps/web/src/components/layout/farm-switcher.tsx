'use client';

import { useEffect, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { activeFarm, session } from '@/lib/api';

/**
 * Multi-farm switching. Selecting a farm re-scopes every page — pages read
 * activeFarm.get() and this reloads to keep all queries consistent.
 */
export function FarmSwitcher() {
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setFarms(session.get()?.farms ?? []);
    setCurrent(activeFarm.get());
  }, []);

  if (farms.length === 0) return null;

  return (
    <div className="relative">
      <select
        aria-label="Switch farm"
        className="h-10 appearance-none rounded-card border border-border bg-surface pl-3 pr-8 text-sm font-medium"
        value={current ?? ''}
        onChange={(e) => {
          activeFarm.set(e.target.value);
          window.location.reload();
        }}
      >
        {farms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
    </div>
  );
}
