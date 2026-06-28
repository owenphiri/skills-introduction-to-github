// src/pages/Signals.jsx — algorithmic signal scanner board
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { signalsService } from "../services/signals";

const CLASSES = ["all", "forex", "metals", "energy", "indices", "crypto", "stocks"];
const TFS = ["M5", "M15", "M30", "H1", "H4"];

function ConfidenceBar({ value }) {
  return (
    <div className="vx-conf">
      <div className="vx-conf-fill" style={{ width: `${value * 10}%` }} />
      <span>{value}/10</span>
    </div>
  );
}

function SignalCard({ s }) {
  const long = s.direction === "LONG";
  return (
    <div className={`vx-signal-card vx-signal-card--${long ? "long" : "short"}`}>
      <div className="vx-signal-top">
        <div>
          <b className="vx-signal-symbol">{s.symbol}</b>
          <span className="vx-muted vx-signal-display">{s.display}</span>
        </div>
        <span className={`vx-pill vx-pill--${long ? "long" : "short"}`}>{s.direction}</span>
      </div>
      <ConfidenceBar value={s.confidence} />
      <div className="vx-signal-levels">
        <div><span>Entry</span><b className="vx-mono">{s.entry}</b></div>
        <div><span>Stop</span><b className="vx-mono vx-down">{s.stop_loss}</b></div>
        <div><span>TP1</span><b className="vx-mono vx-up">{s.tp1}</b></div>
        <div><span>TP2</span><b className="vx-mono vx-up">{s.tp2}</b></div>
        <div><span>TP3</span><b className="vx-mono vx-up">{s.tp3}</b></div>
        <div><span>R:R</span><b className="vx-mono">{s.risk_reward_tp3}</b></div>
      </div>
      <div className="vx-signal-factors">
        {s.confluence_factors?.slice(0, 4).map((f) => (
          <span key={f} className="vx-chip">{f}</span>
        ))}
      </div>
      <div className="vx-signal-foot">
        <span className="vx-muted">{s.session} · {s.timeframe}</span>
        <Link className="vx-inline-link"
          to={`/trade?symbol=${s.symbol}&side=${long ? "buy" : "sell"}`}>
          Trade {s.direction} →
        </Link>
      </div>
    </div>
  );
}

export default function Signals() {
  const [assetClass, setAssetClass] = useState("all");
  const [timeframe, setTimeframe] = useState("M15");
  const [minConfidence, setMinConfidence] = useState(4);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      setLoading(true);
      signalsService.scan({ assetClass, timeframe, minConfidence })
        .then((d) => { if (alive) { setSignals(d.signals); setLoading(false); } })
        .catch(() => alive && setLoading(false));
    };
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [assetClass, timeframe, minConfidence]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Signal Scanner <span className="vx-live-dot">LIVE</span></h1>
          <p className="vx-muted">
            Algorithmic confluence across EMA, RSI, MACD, Bollinger and market structure —
            ranked by conviction, bracketed with stop and three take-profits. Want the full
            AI write-up? <Link to="/terminal" className="vx-inline-link">Open the AI Terminal →</Link>
          </p>
        </div>

        <div className="vx-filters">
          <div className="vx-class-tabs">
            {CLASSES.map((c) => (
              <button key={c} className={c === assetClass ? "active" : ""}
                onClick={() => setAssetClass(c)}>{c}</button>
            ))}
          </div>
          <div className="vx-filters-right">
            <div className="vx-tf-toggle">
              {TFS.map((tf) => (
                <button key={tf} className={tf === timeframe ? "active" : ""}
                  onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
            <label className="vx-conf-filter">
              Min conf {minConfidence}
              <input type="range" min="3" max="9" value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))} />
            </label>
          </div>
        </div>

        {loading && signals.length === 0 && <p className="vx-muted">Scanning markets…</p>}
        {!loading && signals.length === 0 && (
          <div className="vx-empty-state">
            No high-confluence setups right now at this filter. Markets are choppy — lower the
            confidence threshold or check back next session.
          </div>
        )}
        <div className="vx-signal-grid">
          {signals.map((s) => <SignalCard key={`${s.symbol}-${s.timeframe}`} s={s} />)}
        </div>

        <p className="vx-fineprint">
          Signals are automated educational analysis, not financial advice or guaranteed
          outcomes. Always apply your own risk management.
        </p>
      </main>
    </div>
  );
}
