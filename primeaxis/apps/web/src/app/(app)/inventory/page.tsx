'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { activeFarm, api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  unitCost: string;
}

const CATEGORIES = ['ALL', 'FEED', 'VACCINE', 'MEDICATION', 'EQUIPMENT', 'PACKAGING'];

export default function InventoryPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState('ALL');

  useEffect(() => setFarmId(activeFarm.get()), []);
  useEffect(() => {
    if (!farmId) return;
    const q = category === 'ALL' ? '' : `?category=${category}`;
    api.get<Item[]>(`/farms/${farmId}/inventory/items${q}`).then(setItems);
  }, [farmId, category]);

  async function recordUsage(item: Item) {
    const qty = prompt(`Quantity of "${item.name}" used (${item.unit})?`);
    if (!qty || !farmId) return;
    await api.post(`/farms/${farmId}/inventory/items/${item.id}/movements`, {
      type: 'USAGE',
      quantity: Number(qty),
    });
    setCategory((c) => c); // refetch via effect
    const fresh = await api.get<Item[]>(`/farms/${farmId}/inventory/items`);
    setItems(fresh);
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Inventory</h1>

        {/* Filter row — one row above the content, horizontally scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                category === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const low = item.quantity <= item.reorderLevel;
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{item.name}</h3>
                  {low && <Badge tone="warning">⚠ Low stock</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.category.toLowerCase()} · reorder at{' '}
                  {formatNumber(item.reorderLevel)} {item.unit}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatNumber(item.quantity, 1)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {item.unit}
                  </span>
                </p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => recordUsage(item)}>
                  Record usage
                </Button>
              </Card>
            );
          })}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items in this category.</p>
          )}
        </div>
      </main>
    </>
  );
}
