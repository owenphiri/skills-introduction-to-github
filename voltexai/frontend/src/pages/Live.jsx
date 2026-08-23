// src/pages/Live.jsx — Voltex Live (session clocks + live trading streams)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { sessionsService } from "../services/hub";
import { KpiStrip } from "../components/Analytics";

export default function Live() {
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
          <p className="vx-muted">
            Market session clocks and the live trading-session schedule —
            London opens, NY killzones and weekly outlooks with the desk.
          </p>
        </div>

        <KpiStrip ids={["sessions", "fear_greed", "bullish", "products"]} title="Session pulse" />

        {!d && <p className="vx-muted">Syncing the clocks…</p>}
        {d && (
          <>
            <div className="vx-sessions-head">
              <span className="vx-clock">{d.utc_time}</span>
              {d.london_ny_overlap && (
                <span className="vx-overlap-badge">⚡ London × New York overlap — peak liquidity</span>
              )}
            </div>

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
                  <p className="vx-session-hours">{s.open_utc}–{s.close_utc} UTC</p>
                </div>
              ))}
            </div>

            <h2 className="vx-section-title">Upcoming live streams</h2>
            <div className="vx-stream-list">
              {d.streams.map((s, i) => (
                <div key={i} className={`vx-stream-row ${s.is_live ? "live" : ""}`}>
                  <div className="vx-stream-when">
                    {s.is_live ? <span className="vx-live-badge">● LIVE</span>
                               : <span className="vx-stream-time">{s.starts_utc}</span>}
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
        <p className="vx-fineprint">Session times are indicative (UTC). Streams are hosted inside the Terminal for members.</p>
      </main>
      <Footer />
    </div>
  );
}
