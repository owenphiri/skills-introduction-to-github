// src/pages/Sentiment.jsx — Voltex Sentiment (market mood)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { sentimentService } from "../services/hub";

function Gauge({ value, label }) {
  // semicircular gauge 0-100
  const angle = -90 + (value / 100) * 180;
  const color = value >= 60 ? "var(--vx-success)" : value >= 45 ? "var(--vx-warn)" : "var(--vx-danger)";
  return (
    <div className="vx-gauge">
      <svg viewBox="0 0 200 110" width="100%">
        <path d="M10 100 A90 90 0 0 1 190 100" fill="none" stroke="var(--vx-border)" strokeWidth="16" strokeLinecap="round" />
        <path d="M10 100 A90 90 0 0 1 190 100" fill="none" stroke={color} strokeWidth="16"
          strokeLinecap="round" strokeDasharray={`${(value / 100) * 283} 283`} />
        <g transform={`rotate(${angle} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="28" stroke={color} strokeWidth="3" />
          <circle cx="100" cy="100" r="6" fill={color} />
        </g>
      </svg>
      <div className="vx-gauge-value" style={{ color }}>{value}</div>
      <div className="vx-gauge-label">{label}</div>
    </div>
  );
}

export default function Sentiment() {
  const [d, setD] = useState(null);

  useEffect(() => {
    const load = () => sentimentService.overview().then(setD).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🌡️ Voltex Sentiment</h1>
          <p className="vx-muted">
            The market's mood at a glance — a live Fear &amp; Greed gauge and
            bullish/bearish bias computed across the whole instrument universe.
          </p>
        </div>

        {!d && <p className="vx-muted">Reading the market…</p>}
        {d && (
          <>
            <div className="vx-sentiment-top">
              <div className="vx-fg-card"><Gauge value={d.fear_greed} label={d.label} /></div>
              <div className="vx-mood-split">
                <div className="vx-mood-bars">
                  <div className="vx-mood-row">
                    <span className="vx-up">Bullish</span>
                    <div className="vx-mood-track"><div className="vx-mood-fill up" style={{ width: `${d.bullish_pct}%` }} /></div>
                    <b>{d.bullish_pct}%</b>
                  </div>
                  <div className="vx-mood-row">
                    <span className="vx-down">Bearish</span>
                    <div className="vx-mood-track"><div className="vx-mood-fill down" style={{ width: `${100 - d.bullish_pct}%` }} /></div>
                    <b>{100 - d.bullish_pct}%</b>
                  </div>
                </div>
                <p className="vx-muted">{d.bullish} bullish · {d.bearish} bearish · {d.neutral} neutral instruments</p>
                <div className="vx-class-moods">
                  {d.by_class.map((c) => (
                    <div key={c.asset_class} className="vx-class-mood">
                      <span>{c.asset_class}</span>
                      <div className="vx-mini-track"><div style={{ width: `${c.bullish_pct}%` }} /></div>
                      <small>{c.bullish_pct}%</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vx-sentiment-lists">
              <div className="vx-sent-col">
                <h3 className="vx-up">Most bullish</h3>
                {d.top_bullish.map((r) => (
                  <div key={r.symbol} className="vx-sent-row"><b>{r.symbol}</b>
                    <span className="vx-up">▲ {r.momentum_pct}%</span></div>
                ))}
              </div>
              <div className="vx-sent-col">
                <h3 className="vx-down">Most bearish</h3>
                {d.top_bearish.map((r) => (
                  <div key={r.symbol} className="vx-sent-row"><b>{r.symbol}</b>
                    <span className="vx-down">▼ {Math.abs(r.momentum_pct)}%</span></div>
                ))}
              </div>
            </div>
          </>
        )}
        <p className="vx-fineprint">Sentiment is computed from algorithmic bias & momentum — educational, not advice.</p>
      </main>
      <Footer />
    </div>
  );
}
