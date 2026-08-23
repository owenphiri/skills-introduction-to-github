// src/components/Analytics.jsx — lightweight SVG analytics + KPI cards
import { useEffect, useState } from "react";
import { dashboardService } from "../services/hub";

// tiny sparkline from a 0..100 normalised series
export function Sparkline({ data = [], color = "var(--vx-accent)", h = 28, w = 88 }) {
  if (!data.length) return <svg width={w} height={h} />;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`);
  return (
    <svg width={w} height={h} className="vx-spark" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// horizontal labelled bar series (analytics)
export function BarSeries({ series = [], color = "var(--vx-primary)" }) {
  return (
    <div className="vx-barseries">
      {series.map((s) => (
        <div key={s.label} className="vx-bar-row">
          <span className="vx-bar-label">{s.label}</span>
          <div className="vx-bar-track">
            <div className="vx-bar-fill" style={{ width: `${s.value}%`,
              background: s.open === false ? "var(--vx-border)" : color }} />
          </div>
          <b className="vx-bar-val">{s.value}%</b>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ k }) {
  const delta = k.delta;
  return (
    <div className="vx-kpi-card" style={{ "--kpi-accent": k.accent || "var(--vx-primary)" }}>
      <div className="vx-kpi-top">
        <span className="vx-kpi-label">{k.label}</span>
        {k.badge && <span className="vx-kpi-badge">{k.badge}</span>}
      </div>
      <div className="vx-kpi-value">
        {k.value}<small>{k.suffix}</small>
      </div>
      <div className="vx-kpi-foot">
        {typeof delta === "number" && (
          <span className={delta >= 0 ? "vx-up" : "vx-down"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        )}
        <span className="vx-kpi-sub">{k.sub}</span>
        {k.spark && <Sparkline data={k.spark} color={k.accent} />}
      </div>
    </div>
  );
}

// Drop-in advanced KPI strip. Fetches the live snapshot once; `ids` filters,
// `max` caps how many cards show (compact strips for content pages).
export function KpiStrip({ ids, max, title = "Live dashboard" }) {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    dashboardService.snapshot().then((d) => setKpis(d.kpis)).catch(() => {});
  }, []);

  if (!kpis) return null;
  let list = ids ? ids.map((id) => kpis.find((k) => k.id === id)).filter(Boolean) : kpis;
  if (max) list = list.slice(0, max);

  return (
    <section className="vx-kpi-strip">
      <div className="vx-kpi-strip-head">
        <span className="vx-kpi-strip-title">📊 {title}</span>
      </div>
      <div className="vx-kpi-grid">
        {list.map((k) => <KpiCard key={k.id} k={k} />)}
      </div>
    </section>
  );
}
