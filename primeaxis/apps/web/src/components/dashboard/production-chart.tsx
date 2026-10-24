'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardTitle } from '@/components/ui/card';
import { chart } from './chart-theme';

/**
 * Single-series line (title names the series, so no legend box):
 * hen-day egg % for layer farms, average weight for broiler farms.
 * Crosshair + tooltip per the interaction spec; hairline grid, 2px line.
 */
export function ProductionChart({
  title,
  data,
  unit,
  projected7d,
}: {
  title: string;
  data: { date: string; value: number }[];
  unit: string;
  projected7d?: number | null;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {projected7d != null && (
          <span className="text-xs text-muted-foreground">
            7-day projection: <strong className="text-foreground">{projected7d}{unit}</strong>
          </span>
        )}
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="date"
              tick={chart.axisTick}
              tickFormatter={(d: string) => d.slice(5)}
              axisLine={{ stroke: chart.grid }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={chart.axisTick}
              axisLine={false}
              tickLine={false}
              width={56}
              unit={unit}
            />
            <Tooltip
              {...chart.tooltip}
              formatter={(v: number) => [`${v}${unit}`, title]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chart.series1}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
