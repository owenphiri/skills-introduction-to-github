'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { activeFarm, api } from '@/lib/api';
import { gmapsUrl, osmEmbedUrl, wazeNavigateUrl } from '@/lib/waze';

interface Farm {
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}
interface Supplier {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/** Farm mapping + one-tap Waze navigation to the farm and its suppliers. */
export default function MapPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => setFarmId(activeFarm.get()), []);
  useEffect(() => {
    if (!farmId) return;
    api.get<Farm>(`/farms/${farmId}`).then(setFarm);
    api.get<Supplier[]>(`/farms/${farmId}/inventory/suppliers`).then(setSuppliers);
  }, [farmId]);

  const located = farm?.latitude != null && farm?.longitude != null;

  return (
    <>
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Farm map & directions</h1>

        {located ? (
          <>
            <Card className="overflow-hidden p-0">
              <iframe
                title={`Map of ${farm!.name}`}
                src={osmEmbedUrl(farm!.latitude!, farm!.longitude!)}
                className="h-72 w-full border-0 sm:h-96"
                loading="lazy"
              />
            </Card>
            <div className="flex flex-wrap gap-2">
              <a href={wazeNavigateUrl(farm!.latitude!, farm!.longitude!)} target="_blank" rel="noopener noreferrer">
                <Button>
                  <Navigation className="size-4" /> Navigate with Waze
                </Button>
              </a>
              <a href={gmapsUrl(farm!.latitude!, farm!.longitude!)} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">Google Maps</Button>
              </a>
            </div>
          </>
        ) : (
          <Card>
            <p className="text-sm text-muted-foreground">
              Set the farm&apos;s location in Settings to enable the map and Waze
              directions for drivers and buyers.
            </p>
          </Card>
        )}

        <Card>
          <CardTitle>Suppliers</CardTitle>
          <ul className="mt-2 divide-y divide-border">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-faint-foreground" /> {s.name}
                </span>
                {s.latitude != null && s.longitude != null ? (
                  <a
                    href={wazeNavigateUrl(s.latitude, s.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary"
                  >
                    Waze →
                  </a>
                ) : (
                  <span className="text-xs text-faint-foreground">no location</span>
                )}
              </li>
            ))}
            {suppliers.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No suppliers yet.</p>
            )}
          </ul>
        </Card>
      </main>
    </>
  );
}
