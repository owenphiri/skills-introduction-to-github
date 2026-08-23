// src/pages/Dashboard.jsx — Voltex Command Center (advanced KPI + analytics dashboard)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { BarSeries, Sparkline } from "../components/Analytics";
import { VMarquee } from "../components/VMarquee";
import { SocialBar } from "../components/Social";
import { dashboardService } from "../services/hub";

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    const load = () => dashboardService.snapshot().then(setD).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-dash-head">
          <div>
            <h1>📊 Voltex Command Center</h1>
            <p className="vx-muted">
              One live pulse of the whole platform — KPIs, market analytics and
              the community, updating in real time.
            </p>
          </div>
          <div className="vx-dash-clock">
            <span className="vx-live-badge">● LIVE</span>
            <span className="vx-clock">{d?.utc_time || "—"}</span>
          </div>
        </div>

        {!d && <p className="vx-muted">Booting the command center…</p>}
        {d && (
          <>
            {/* KPI grid */}
            <div className="vx-kpi-grid">
              {d.kpis.map((k) => (
                <div key={k.id} className="vx-kpi-card"
                     style={{ "--kpi-accent": k.accent || "var(--vx-primary)" }}>
                  <div className="vx-kpi-top">
                    <span className="vx-kpi-label">{k.label}</span>
                    {k.badge && <span className="vx-kpi-badge">{k.badge}</span>}
                  </div>
                  <div className="vx-kpi-value">{k.value}<small>{k.suffix}</small></div>
                  <div className="vx-kpi-foot">
                    {typeof k.delta === "number" && (
                      <span className={k.delta >= 0 ? "vx-up" : "vx-down"}>
                        {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}
                      </span>
                    )}
                    <span className="vx-kpi-sub">{k.sub}</span>
                    {k.spark && <Sparkline data={k.spark} color={k.accent} />}
                  </div>
                </div>
              ))}
            </div>

            {/* Analytics + dual vertical marquee */}
            <div className="vx-dash-body">
              <div className="vx-analytics-col">
                <div className="vx-panel">
                  <h3>Bullish bias by asset class</h3>
                  <BarSeries series={d.analytics.by_class} color="var(--vx-success)" />
                </div>
                <div className="vx-panel">
                  <h3>Session progress</h3>
                  <BarSeries series={d.analytics.sessions} color="var(--vx-primary)" />
                </div>
                <div className="vx-highlight-row">
                  {d.highlights.map((h) => (
                    <div key={h.label} className="vx-highlight">
                      <b>{h.value}</b><span>{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vx-marquee-col">
                <VMarquee title="⚡ Live movers" dir="down" items={d.marquee.movers}
                  render={(m) => (
                    <span className={m.kind === "up" ? "vx-up" : "vx-down"}>{m.text}</span>
                  )} />
                <VMarquee title="🏆 Community wins" dir="up" items={d.marquee.wins}
                  render={(w) => (
                    <div className="vx-win-item">
                      <b>{w.who}</b><span>{w.text}</span>
                    </div>
                  )} />
              </div>
            </div>

            <div className="vx-dash-social">
              <span className="vx-muted">Join the movement — trade with the team:</span>
              <SocialBar />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
