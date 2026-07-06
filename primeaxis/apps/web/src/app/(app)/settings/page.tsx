'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { FollowUs } from '@/components/social/follow-us';
import { activeFarm, api } from '@/lib/api';

interface Farm {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  currency: string;
  members: { id: string; role: string; user: { email: string; fullName: string } }[];
}

export default function SettingsPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setFarmId(activeFarm.get()), []);
  useEffect(() => {
    if (farmId) api.get<Farm>(`/farms/${farmId}`).then(setFarm);
  }, [farmId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!farmId) return;
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await api.patch(`/farms/${farmId}`, {
      name: raw.name,
      address: raw.address || undefined,
      latitude: raw.latitude ? Number(raw.latitude) : undefined,
      longitude: raw.longitude ? Number(raw.longitude) : undefined,
      currency: raw.currency || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Farm settings</h1>

        {farm && (
          <Card>
            <CardTitle>Details & location</CardTitle>
            <form onSubmit={onSubmit} className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="name">Farm name</Label>
                <Input id="name" name="name" defaultValue={farm.name} required />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={farm.address ?? ''} />
              </div>
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" name="latitude" type="number" step="any"
                  inputMode="decimal" defaultValue={farm.latitude ?? ''} placeholder="-10.2129" />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" name="longitude" type="number" step="any"
                  inputMode="decimal" defaultValue={farm.longitude ?? ''} placeholder="31.1808" />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" maxLength={3} defaultValue={farm.currency} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Button type="submit">Save settings</Button>
                {saved && <span className="text-sm text-good">Saved ✓</span>}
              </div>
            </form>
          </Card>
        )}

        {farm && (
          <Card>
            <CardTitle>Team</CardTitle>
            <ul className="mt-2 divide-y divide-border text-sm">
              {farm.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <span>
                    {m.user.fullName}
                    <span className="ml-2 text-muted-foreground">{m.user.email}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{m.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint-foreground">
              Owners can invite managers and workers via the API
              (`POST /farms/:farmId/members`); the invite UI is the next iteration.
            </p>
          </Card>
        )}

        <Card>
          <FollowUs />
        </Card>
      </main>
    </>
  );
}
