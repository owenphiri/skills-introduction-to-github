// src/components/Chart.jsx — dependency-free SVG charts (sparkline + candles)

export function Sparkline({ data = [], width = 120, height = 36, up }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) =>
    `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`
  ).join(" ");
  const rising = up ?? data[data.length - 1] >= data[0];
  const stroke = rising ? "var(--vx-success)" : "var(--vx-danger)";
  return (
    <svg width={width} height={height} className="vx-spark">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function CandleChart({ candles = [], width = 640, height = 240 }) {
  if (candles.length < 2) return <div className="vx-chart-empty">No data</div>;
  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const cw = w / candles.length;
  const y = (v) => pad + h - ((v - min) / span) * h;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="vx-candles"
      preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={width - pad} y1={pad + h * g} y2={pad + h * g}
          stroke="var(--vx-border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {candles.map((c, i) => {
        const x = pad + i * cw + cw / 2;
        const bull = c.close >= c.open;
        const col = bull ? "var(--vx-success)" : "var(--vx-danger)";
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBot = y(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth="1" />
            <rect x={x - Math.max(1, cw * 0.3)} y={bodyTop}
              width={Math.max(2, cw * 0.6)} height={Math.max(1, bodyBot - bodyTop)}
              fill={col} />
          </g>
        );
      })}
    </svg>
  );
}
