// src/pages/AdminAnalytics.jsx — deep admin analytics command center
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { adminService } from "../services/hub";
import { useAuth } from "../contexts/AuthContext";

function Equity({ points }) {
  if (!points.length) return <p className="vx-muted">No closed signals yet.</p>;
  const w = 680, h = 200, pad = 10;
  const rs = points.map((p) => p.r);
  const lo = Math.min(0, ...rs), hi = Math.max(0, ...rs), span = hi - lo || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const pts = points.map((p, i) => `${(pad + i * step).toFixed(1)},${y(p.r).toFixed(1)}`);
  const last = rs[rs.length - 1];
  const color = last >= 0 ? "var(--vx-success)" : "var(--vx-danger)";
  return (
    <svg className="vx-equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1={pad} y1={y(0)} x2={w - pad} y2={y(0)} stroke="var(--vx-border)" strokeDasharray="4 4" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function Histogram({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="vx-hist">
      {data.map((d) => (
        <div key={d.bucket} className="vx-hist-col">
          <div className="vx-hist-bar" style={{ height: `${(d.count / max) * 100}%` }}><span>{d.count}</span></div>
          <small>{d.bucket}</small>
        </div>
      ))}
    </div>
  );
}

function SurvivalCurve({ curve }) {
  if (!curve.length) return <p className="vx-muted">No VIP tenure data yet.</p>;
  const w = 640, h = 170, pad = 10;
  const step = curve.length > 1 ? (w - pad * 2) / (curve.length - 1) : 0;
  const y = (v) => h - pad - (v / 100) * (h - pad * 2);
  const pts = curve.map((c, i) => `${(pad + i * step).toFixed(1)},${y(c.pct).toFixed(1)}`);
  return (
    <svg className="vx-equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 25, 50, 75, 100].map((g) => (
        <line key={g} x1={pad} y1={y(g)} x2={w - pad} y2={y(g)} stroke="var(--vx-border)" strokeDasharray="3 4" />
      ))}
      <polyline points={pts.join(" ")} fill="none" stroke="var(--vx-accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {curve.map((c, i) => (
        <circle key={i} cx={pad + i * step} cy={y(c.pct)} r="3" fill="var(--vx-accent)" />
      ))}
    </svg>
  );
}

function cohortColor(pct) {
  if (pct >= 66) return "color-mix(in srgb, var(--vx-success) 55%, transparent)";
  if (pct >= 33) return "color-mix(in srgb, var(--vx-warn) 50%, transparent)";
  if (pct > 0) return "color-mix(in srgb, var(--vx-danger) 45%, transparent)";
  return "var(--vx-bg-elev)";
}

function RBars({ rows, unit = "R" }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net_r)));
  return (
    <div className="vx-rbars">
      {rows.map((r) => (
        <div key={r.label} className="vx-rbar-row">
          <span className="vx-rbar-label">{r.label}</span>
          <div className="vx-rbar-track">
            <div className={`vx-rbar-fill ${r.net_r >= 0 ? "pos" : "neg"}`}
              style={{ width: `${(Math.abs(r.net_r) / max) * 100}%` }} />
          </div>
          <b className={r.net_r >= 0 ? "vx-up" : "vx-down"}>{r.net_r >= 0 ? "+" : ""}{r.net_r}{unit}</b>
          <small className="vx-muted">{r.count} · {r.win_rate}%</small>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user?.role === "admin") adminService.analytics().then(setD).catch(() => setErr("Could not load analytics."));
  }, [user]);

  if (!user) return null;
  if (user.role !== "admin") {
    return (
      <div className="vx-page"><NavBar />
        <main className="vx-container"><div className="vx-page-head">
          <h1>🔒 Admin only</h1><Link to="/pro-signals" className="vx-btn-primary vx-btn-sm">Signals Pro</Link>
        </div></main><Footer /></div>
    );
  }

  const t = d?.signals.totals;
  const sub = d?.subscribers;
  const ref = d?.referrals;

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Admin · Command Center</span>
          <h1>📊 Analytics</h1>
          <p className="vx-muted">The whole signal business at a glance — performance, subscribers, affiliates and the RL model.</p>
          <Link to="/admin/signals" className="vx-btn-ghost vx-btn-sm">← Signals desk</Link>
        </div>
        {err && <p className="vx-down">{err}</p>}
        {!d && !err && <p className="vx-muted">Crunching the numbers…</p>}

        {d && (
          <>
            <div className="vx-kpi-grid">
              {[
                ["Win rate", `${t.win_rate}%`, "#45e0a0"],
                ["Profit factor", t.profit_factor, "#c2f53d"],
                ["Total", `${t.total_r >= 0 ? "+" : ""}${t.total_r}R`, "#4d7cff"],
                ["Expectancy", `${t.expectancy}R`, "#a06bff"],
                ["Signals", t.signals, "#ffb547"],
                ["Avg quality", t.avg_quality, "#4dd0e1"],
                ["Active VIP", sub.active_vip, "#ff5560"],
                ["MRR", `${sub.mrr_stars}⭐`, "#c2f53d"],
              ].map(([label, val, accent]) => (
                <div key={label} className="vx-kpi-card" style={{ "--kpi-accent": accent }}>
                  <div className="vx-kpi-top"><span className="vx-kpi-label">{label}</span></div>
                  <div className="vx-kpi-value">{val}</div>
                </div>
              ))}
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel">
                <h3>Equity curve (cumulative R)</h3>
                <Equity points={d.signals.equity} />
                {d.signals.best && (
                  <p className="vx-muted">Best: <b className="vx-up">{d.signals.best.symbol} +{d.signals.best.r}R</b> ·
                    Worst: <b className="vx-down">{d.signals.worst.symbol} {d.signals.worst.r}R</b></p>
                )}
              </div>
              <div className="vx-panel">
                <h3>R distribution</h3>
                <Histogram data={d.signals.distribution} />
              </div>
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel"><h3>By symbol</h3><RBars rows={d.signals.by_symbol} /></div>
              <div className="vx-panel"><h3>By session</h3><RBars rows={d.signals.by_session} /></div>
            </div>
            <div className="vx-journal-grid">
              <div className="vx-panel"><h3>By grade</h3><RBars rows={d.signals.by_grade} /></div>
              <div className="vx-panel"><h3>By day of week</h3>
                <RBars rows={d.signals.by_dow.filter((x) => x.count).map((x) => ({ label: x.day, net_r: x.net_r, count: x.count, win_rate: x.win_rate }))} />
              </div>
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel">
                <h3>💎 Subscribers</h3>
                <div className="vx-mini-stats">
                  <div><b>{sub.total}</b><span>Total</span></div>
                  <div><b>{sub.active_vip}</b><span>Active VIP</span></div>
                  <div><b>{sub.recurring}</b><span>Recurring</span></div>
                  <div><b>{sub.expired}</b><span>Expired</span></div>
                  <div><b>{sub.new_7d}</b><span>New 7d</span></div>
                  <div><b>{sub.stars_collected}⭐</b><span>Collected</span></div>
                </div>
                {sub.by_plan.length > 0 && (
                  <p className="vx-muted">Plans: {sub.by_plan.map((p) => `${p.plan} ×${p.count}`).join(" · ")}</p>
                )}
              </div>
              <div className="vx-panel">
                <h3>🎁 Affiliates</h3>
                <div className="vx-mini-stats">
                  <div><b>{ref.affiliates}</b><span>Affiliates</span></div>
                  <div><b>{ref.conversions}</b><span>Conversions</span></div>
                  <div><b>{ref.total_clicks}</b><span>Clicks</span></div>
                  <div><b>{ref.payout_stars}⭐</b><span>Paid out</span></div>
                </div>
                {ref.top.length > 0 && (
                  <div className="vx-admin-list" style={{ marginTop: ".75rem" }}>
                    {ref.top.map((a) => (
                      <div key={a.code} className="vx-admin-row">
                        <b>{a.code}</b>
                        <span className="vx-muted">{a.conversions} conv · {a.earned_stars}⭐</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <h2 className="vx-section-title">📈 Retention &amp; cohorts</h2>
            <div className="vx-mini-stats" style={{ marginBottom: "1rem" }}>
              <div><b>{d.retention.summary.converted}</b><span>VIP ever</span></div>
              <div><b className="vx-up">{d.retention.summary.active}</b><span>Active</span></div>
              <div><b className="vx-down">{d.retention.summary.churned}</b><span>Churned</span></div>
              <div><b>{d.retention.summary.churn_rate}%</b><span>Churn rate</span></div>
              <div><b>{d.retention.summary.recurring_share}%</b><span>Recurring</span></div>
              <div><b>{d.retention.summary.avg_lifetime_days}d</b><span>Avg lifetime</span></div>
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel">
                <h3>VIP survival curve</h3>
                <SurvivalCurve curve={d.retention.curve} />
                <p className="vx-muted">% of VIP members still subscribed at each week of tenure.</p>
              </div>
              <div className="vx-panel">
                <h3>Signup cohorts (by month)</h3>
                <div className="vx-cohort-table">
                  <div className="vx-cohort-head">
                    <span>Cohort</span><span>Size</span><span>VIP</span><span>Active</span><span>Retention</span><span>⭐</span>
                  </div>
                  {d.retention.cohorts.length === 0 && <p className="vx-muted">No cohorts yet.</p>}
                  {d.retention.cohorts.map((c) => (
                    <div key={c.cohort} className="vx-cohort-row">
                      <span><b>{c.cohort}</b></span>
                      <span>{c.size}</span>
                      <span>{c.converted}</span>
                      <span>{c.active}</span>
                      <span className="vx-cohort-cell" style={{ background: cohortColor(c.retention_pct) }}>{c.retention_pct}%</span>
                      <span>{c.revenue_stars}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vx-panel vx-rl-panel">
              <div className="vx-rl-head">
                <h3>🧠 RL Model <span className={`vx-rl-status ${d.rl.status}`}>{d.rl.status}</span></h3>
                <span className="vx-muted">{d.rl.updates} updates · {d.rl.win_rate}% win · confidence {Math.round(d.rl.confidence * 100)}%</span>
              </div>
              <div className="vx-rl-weights">
                {d.rl.importance.map((f) => (
                  <div key={f.feature} className="vx-rl-weight">
                    <span>{f.feature.replace(/_/g, " ")}</span>
                    <div className="vx-rl-bar"><div className={f.weight >= 0 ? "pos" : "neg"}
                      style={{ width: `${Math.min(100, Math.abs(f.weight) * 30)}%` }} /></div>
                    <b className={f.weight >= 0 ? "vx-up" : "vx-down"}>{f.weight}</b>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
