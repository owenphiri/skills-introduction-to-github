'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api } from '@/lib/api';

/**
 * The form a worker fills on the house floor — numeric keyboards
 * (inputMode), big targets, idempotent PUT (re-submitting a date corrects it).
 */
export function DailyRecordForm({
  farmId,
  flockId,
  flockType,
  onSaved,
}: {
  farmId: string;
  flockId: string;
  flockType: 'BROILER' | 'LAYER' | 'BREEDER';
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('busy');
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api.put(`/farms/${farmId}/flocks/${flockId}/records`, {
        date: raw.date,
        mortality: Number(raw.mortality || 0),
        feedKg: Number(raw.feedKg || 0),
        waterL: Number(raw.waterL || 0),
        ...(flockType === 'LAYER'
          ? {
              eggsCollected: Number(raw.eggsCollected || 0),
              eggsBroken: Number(raw.eggsBroken || 0),
            }
          : { avgWeightG: raw.avgWeightG ? Number(raw.avgWeightG) : undefined }),
        notes: raw.notes || undefined,
      });
      setStatus('saved');
      onSaved();
      form.reset();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  const num = { type: 'number' as const, inputMode: 'numeric' as const, min: 0 };

  return (
    <Card>
      <CardTitle>Daily entry</CardTitle>
      <form onSubmit={onSubmit} className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" required
            defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="mortality">Deaths</Label>
          <Input id="mortality" name="mortality" {...num} defaultValue={0} required />
        </div>
        <div>
          <Label htmlFor="feedKg">Feed (kg)</Label>
          <Input id="feedKg" name="feedKg" {...num} step="0.1" required />
        </div>
        <div>
          <Label htmlFor="waterL">Water (L)</Label>
          <Input id="waterL" name="waterL" {...num} step="0.1" />
        </div>
        {flockType === 'LAYER' ? (
          <>
            <div>
              <Label htmlFor="eggsCollected">Eggs collected</Label>
              <Input id="eggsCollected" name="eggsCollected" {...num} required />
            </div>
            <div>
              <Label htmlFor="eggsBroken">Broken</Label>
              <Input id="eggsBroken" name="eggsBroken" {...num} defaultValue={0} />
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="avgWeightG">Avg weight (g)</Label>
            <Input id="avgWeightG" name="avgWeightG" {...num} placeholder="sample" />
          </div>
        )}
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="optional" />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={status === 'busy'}>
            {status === 'busy' ? 'Saving…' : 'Save record'}
          </Button>
          {status === 'saved' && <span className="text-sm text-good">Saved ✓</span>}
          {status === 'error' && <span className="text-sm text-critical">{message}</span>}
        </div>
      </form>
    </Card>
  );
}
