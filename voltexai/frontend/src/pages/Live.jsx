// src/pages/Live.jsx — Voltex Live (session clocks + live trading streams)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { sessionsService } from "../services/hub";
import { NewsTrading } from "../components/NewsTrading";
import { GlobeMap } from "../components/GlobeMap";
import { KpiStrip } from "../components/Analytics";
import { useI18n } from "../i18n";

export default function Live() {
  const { t } = useI18n();
  const [d, setD] = useState(null);

  useEffect(() => {
    const load = () => sessionsService.status().then(setD).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🔴 Voltex Live</h1>
          <p className="vx-muted">{t("live.subtitle")}</p>
        </div>

        <KpiStrip ids={["sessions", "fear_greed", "bullish", "products"]} title="Session pulse" />

        <NewsTrading />

        {!d && <p className="vx-muted">Syncing the clocks…</p>}
        {d && (
          <>
            {d.globe && <GlobeMap data={d.globe} />}

            <div className="vx-sessions-head">
              <div className="vx-clock-pair">
                <span className="vx-clock">{d.cat_time}<small> CAT</small></span>
                <span className="vx-clock-utc">{d.utc_time}</span>
              </div>
              {d.quality && (
                <span className={`vx-qtier vx-qtier--${d.quality.tier}`}>
                  {d.quality.tier === "prime" ? "⚡ " : ""}{d.quality.label}
                </span>
              )}
              {d.london_ny_overlap && (
                <span className="vx-overlap-badge">London × New York — peak liquidity</span>
              )}
            </div>

            {d.zambia && (
              <div className="vx-zambia-card">
                <div className="vx-zambia-now">
                  <span className="vx-eyebrow">🇿🇲 {t("live.zambiaTrader")} · {d.zambia.timezone}</span>
                  <p className="vx-zambia-advice">{d.zambia.current.advice}</p>
                  <p className="vx-muted">{t("live.bestWindow")}: <b>{d.zambia.best_window_cat} CAT</b></p>
                </div>
                <div className="vx-zambia-windows">
                  {d.zambia.windows.map((w) => (
                    <div key={w.name} className={`vx-zwin ${w.cat === d.zambia.best_window_cat ? "prime" : ""}`}>
                      <div className="vx-zwin-top"><b>{w.name}</b><span className="mono">{w.cat}</span></div>
                      <span className="vx-muted">{w.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d.world_clocks && (
              <div className="vx-worldclocks">
                {d.world_clocks.map((w) => (
                  <div key={w.label} className="vx-wclock">
                    <span className="vx-wclock-time">{w.time}</span>
                    <span className="vx-wclock-label">{w.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="vx-session-grid">
              {d.sessions.map((s) => (
                <div key={s.name} className={`vx-session-card ${s.open ? "open" : ""}`}>
                  <div className="vx-session-top">
                    <span className="vx-session-flag">{s.flag}</span>
                    <span className={`vx-session-dot ${s.open ? "on" : "off"}`} />
                  </div>
                  <h3>{s.name}</h3>
                  <p className={s.open ? "vx-up" : "vx-muted"}>{s.open ? "OPEN" : "CLOSED"}</p>
                  <p className="vx-session-meta">{s.state} <b>{s.hours_to_change}h</b></p>
                  <p className="vx-session-hours"><b>{s.open_cat}–{s.close_cat}</b> CAT</p>
                  <p className="vx-session-hours vx-muted">{s.open_utc}–{s.close_utc} UTC</p>
                </div>
              ))}
            </div>

            <h2 className="vx-section-title">Upcoming live streams</h2>
            <div className="vx-stream-list">
              {d.streams.map((s, i) => (
                <div key={i} className={`vx-stream-row ${s.is_live ? "live" : ""}`}>
                  <div className="vx-stream-when">
                    {s.is_live ? <span className="vx-live-badge">● LIVE</span>
                               : <span className="vx-stream-time">{s.starts_cat || s.starts_utc}<small> CAT</small></span>}
                  </div>
                  <div className="vx-stream-main">
                    <b>{s.title}</b>
                    <span className="vx-muted">{s.focus}</span>
                  </div>
                  <div className="vx-stream-side">
                    <span className="vx-stream-host">{s.host}</span>
                    <span className="vx-chip">{s.level}</span>
                    <span className="vx-muted">{s.duration_min}m</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="vx-fineprint">Session times shown in CAT (Zambia, UTC+2) and UTC. Indicative — DST not modelled. Streams are hosted inside the Terminal for members.</p>
      </main>
      <Footer />
    </div>
  );
}
