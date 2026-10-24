import { Card, CardTitle } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';

/**
 * Stat tile: one headline figure per KPI. Trend delta is text + arrow
 * (never color alone); the value stays in ink tokens, not series color.
 */
export function KpiCard({
  title,
  value,
  unit,
  dp = 0,
  delta,
  deltaGoodWhen = 'down',
}: {
  title: string;
  value: number | null | undefined;
  unit?: string;
  dp?: number;
  /** percentage-point or absolute change vs previous period */
  delta?: number | null;
  /** mortality/FCR improve when falling; egg % improves when rising */
  deltaGoodWhen?: 'up' | 'down';
}) {
  const good =
    delta != null && (deltaGoodWhen === 'down' ? delta <= 0 : delta >= 0);

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-1 text-2xl font-semibold sm:text-3xl">
        {formatNumber(value, dp)}
        {unit && value != null && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        )}
      </p>
      {delta != null && (
        <p className={cn('mt-1 text-xs', good ? 'text-good' : 'text-critical')}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {formatNumber(Math.abs(delta), 1)}
          <span className="text-faint-foreground"> vs last week</span>
        </p>
      )}
    </Card>
  );
}
