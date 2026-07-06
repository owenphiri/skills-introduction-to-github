'use client';

import { AlertTriangle, Bell, Info, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import type { LiveAlert } from '@/hooks/use-live-kpis';

const severityMeta = {
  CRITICAL: { tone: 'critical' as const, Icon: AlertTriangle },
  WARNING: { tone: 'warning' as const, Icon: Bell },
  INFO: { tone: 'neutral' as const, Icon: Info },
};

/** Live alert feed — new items arrive over the socket. Icon + label always
 *  accompany the severity color (state is never color-alone). */
export function AlertsFeed({
  alerts,
  onDismiss,
}: {
  alerts: LiveAlert[];
  onDismiss: (id: string) => void;
}) {
  return (
    <Card>
      <CardTitle>Alerts</CardTitle>
      {alerts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          All clear — no unread alerts.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {alerts.map((alert) => {
            const { tone, Icon } = severityMeta[alert.severity];
            return (
              <li
                key={alert.id}
                className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-3"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone}>{alert.severity}</Badge>
                    <span className="text-xs text-faint-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{alert.message}</p>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  aria-label="Dismiss alert"
                  className="rounded p-1 text-faint-foreground hover:bg-border/50"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
