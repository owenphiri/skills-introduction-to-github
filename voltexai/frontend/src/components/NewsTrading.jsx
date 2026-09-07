// src/components/NewsTrading.jsx — high-impact news events + live trading windows
import { useEffect, useState } from "react";
import { newsService } from "../services/hub";

function EventCard({ e, open, onToggle }) {
  return (
    <div className={`vx-news-card impact-${e.impact} ${e.live ? "is-live" : ""}`}>
      <div className="vx-news-top" onClick={onToggle} role="button" tabIndex={0}>
        <div className="vx-news-id">
          <span className="vx-news-code">{e.code || e.name}</span>
          <span className="vx-news-name">{e.name}</span>
        </div>
        <div className="vx-news-when">
          {e.live
            ? <span className="vx-live-badge">● LIVE · {e.phase}</span>
            : <span className="vx-news-count">in {e.countdown}</span>}
          <span className={`vx-news-impact impact-${e.impact}`}>{e.impact}</span>
        </div>
      </div>
      <div className="vx-news-sub">
        <span className="vx-chip">{e.currency}</span>
        <span className="vx-muted">{e.release_cat} CAT</span>
        <span className="vx-muted vx-news-utc">{e.release_utc} UTC</span>
      </div>
      {open && (
        <div className="vx-news-detail">
          <p className="vx-news-why">{e.why}</p>
          <div className="vx-news-instruments">
            {(e.instruments || []).map((s) => <span key={s} className="vx-chip">{s}</span>)}
          </div>
          <b className="vx-news-plabel">Trade playbook</b>
          <ul className="vx-news-playbook">
            {(e.playbook || []).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NewsTrading() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const load = () => newsService.status(10).then(setD).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (!d) return null;
  const list = [...(d.live || []), ...(d.upcoming || [])];

  return (
    <section className="vx-news">
      <div className="vx-news-head">
        <div>
          <span className="vx-eyebrow">📰 News Trading · High-impact events</span>
          <h2 className="vx-section-title" style={{ margin: "4px 0 0" }}>
            CPI · NFP · FOMC — the prints that move markets
          </h2>
        </div>
        {d.next && !(d.live && d.live.length) && (
          <div className="vx-news-next">
            <span className="vx-muted">Next</span>
            <b>{d.next.name}</b>
            <span className="vx-news-count">in {d.next.countdown}</span>
          </div>
        )}
        {d.live && d.live.length > 0 && (
          <span className="vx-live-badge vx-news-livewrap">● {d.live.length} LIVE NOW</span>
        )}
      </div>

      {d.imminent && d.imminent.length > 0 && (
        <div className="vx-news-alert">⚠️ Imminent: {d.imminent.map((e) => `${e.name} (${e.countdown})`).join(" · ")} — expect volatility & wider spreads.</div>
      )}

      <div className="vx-news-grid">
        {list.map((e) => (
          <EventCard key={e.code + e.release_iso} e={e}
            open={open === e.code + e.release_iso}
            onToggle={() => setOpen(open === e.code + e.release_iso ? null : e.code + e.release_iso)} />
        ))}
      </div>

      <div className="vx-news-foot">
        <b>How VoltexAI trades news:</b>
        <ul>{(d.general_playbook || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
        <p className="vx-fineprint">{d.disclaimer}</p>
      </div>
    </section>
  );
}
