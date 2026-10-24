'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardTitle } from '@/components/ui/card';
import { chart } from './chart-theme';

/**
 * Grouped bars, two series on ONE axis (revenue & costs share a currency
 * scale — profit belongs in the tooltip, not a second axis). Legend present
 * (≥2 series); 4px rounded data-ends; 2px gap between adjacent bars.
 */
export function RevenueCostChart({
  data,
  currency,
}: {
  data: { month: string; revenue: number; costs: number; profit: number }[];
  currency: string;
}) {
  return (
    <Card>
      <CardTitle>Revenue vs costs — last {data.length} months</CardTitle>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="month"
              tick={chart.axisTick}
              axisLine={{ stroke: chart.grid }}
              tickLine={false}
            />
            <YAxis
              tick={chart.axisTick}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`}
            />
            <Tooltip
              {...chart.tooltip}
              formatter={(v: number, name: string) => [
                `${currency} ${v.toLocaleString()}`,
                name,
              ]}
              // profit surfaces here rather than as a third mark
              labelFormatter={(label: string) => {
                const row = data.find((d) => d.month === label);
                return row
                  ? `${label} — profit ${currency} ${row.profit.toLocaleString()}`
                  : label;
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
            />
            <Bar dataKey="revenue" name="Revenue" fill={chart.series1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="costs" name="Costs" fill={chart.series3} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
