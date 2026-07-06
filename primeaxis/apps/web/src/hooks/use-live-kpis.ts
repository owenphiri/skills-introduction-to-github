'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export interface FarmKpis {
  farmId: string;
  activeFlocks: number;
  birdsAlive: number;
  mortalityRatePct: number;
  avgFcr: number | null;
  avgAdg: number | null;
  henDayPct: number | null;
  eggsToday: number;
  feedTodayKg: number;
  flocks: {
    flockId: string;
    ageDays: number;
    birdsAlive: number;
    mortalityRatePct: number;
    fcr: number | null;
    henDayPct: number | null;
    trend: { series: { date: string; value: number }[]; projected7d: number | null };
  }[];
}

export interface LiveAlert {
  id: string;
  kind: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
}

/**
 * The real-time dashboard hook (deliverable 6, client side).
 * Seeds from REST, then patches from the `kpi:update` / `alert:new` socket
 * events — a cold load and a live update render identically.
 */
export function useLiveKpis(farmId: string | null) {
  const [kpis, setKpis] = useState<FarmKpis | null>(null);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!farmId) return;

    let cancelled = false;
    Promise.all([
      api.get<FarmKpis>(`/farms/${farmId}/kpis`),
      api.get<LiveAlert[]>(`/farms/${farmId}/alerts?unread=true`),
    ]).then(([k, a]) => {
      if (!cancelled) {
        setKpis(k);
        setAlerts(a);
      }
    });

    const socket = getSocket();
    socket.emit('join', farmId);

    const onKpi = (payload: FarmKpis) => payload.farmId === farmId && setKpis(payload);
    const onAlert = (alert: LiveAlert) => setAlerts((prev) => [alert, ...prev].slice(0, 50));
    const onConnect = () => {
      setConnected(true);
      socket.emit('join', farmId); // re-join after reconnects
    };
    const onDisconnect = () => setConnected(false);

    socket.on('kpi:update', onKpi);
    socket.on('alert:new', onAlert);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);

    return () => {
      cancelled = true;
      socket.emit('leave', farmId);
      socket.off('kpi:update', onKpi);
      socket.off('alert:new', onAlert);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [farmId]);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    if (farmId) void api.patch(`/farms/${farmId}/alerts/${id}/read`);
  };

  return { kpis, alerts, connected, dismissAlert };
}
