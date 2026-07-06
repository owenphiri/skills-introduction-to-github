/**
 * Chart chrome shared by every Recharts chart. Series colors come from the
 * validated palette in globals.css (--chart-1…4, fixed slot order — never
 * cycled or reassigned when series counts change).
 */
export const chart = {
  series1: 'var(--chart-1)', // blue
  series2: 'var(--chart-2)', // aqua
  series3: 'var(--chart-3)', // yellow
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  axisTick: { fill: 'var(--chart-axis)', fontSize: 11 } as const,
  tooltip: {
    contentStyle: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      color: 'var(--foreground)',
      fontSize: 12,
    },
    cursor: { stroke: 'var(--chart-axis)', strokeWidth: 1 },
  },
};
