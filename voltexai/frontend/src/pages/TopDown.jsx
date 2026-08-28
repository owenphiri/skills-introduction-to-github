// src/pages/TopDown.jsx — Top-Down multi-timeframe day-trading read
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { signalsService } from "../services/signals";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD", "NAS100", "US30", "SPX500"];
const MODES = [
  ["day", "Day trading", "D1 → 1H"],
  ["intraday", "Intraday", "4H → 15M"],
];

function Tf({ tf, direction, grade }) {
  const cls = direction === "LONG" ? "up" : direction === "SHORT" ? "down" : "flat";
  return (
    <div className={`vx-td-tf ${cls}`}>
      <span className="vx-td-tf-tf">{tf}</span>
      <b>{direction === "LONG" ? "▲ Bullish" : direction === "SHORT" ? "▼ Bearish" : "— Neutral"}</b>
      {grade && grade !== "—" && <span className="vx-td-grade">{grade}</span>}
    </div>
  );
}

export default function TopDown() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [mode, setMode] = useState("day");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = () => signalsService.topdown(symbol, mode)
      .then((r) => alive && setD(r)).catch(() => {}).finally(() => alive && setLoading(false));
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [symbol, mode]);

  const trade = d?.verdict === "TRADE";
  const e = d?.entry;

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Voltex Strategy</span>
          <h1>🧭 Top-Down Analysis</h1>
          <p className="vx-muted">
            Read the bias on the higher timeframe, take the entry on the lower — and only
            trade when they agree. Simple, disciplined, and self-optimised by the RL layer.
          </p>
        </div>

        <div className="vx-td-controls">
          <select value={symbol} onChange={(ev) => setSymbol(ev.target.value)}>
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="vx-tf-toggle">
            {MODES.map(([id, label, sub]) => (
              <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
                {label} <small>{sub}</small>
              </button>
            ))}
          </div>
        </div>

        {!d && <p className="vx-muted">Reading the timeframes…</p>}
        {d && (
          <>
            <div className={`vx-td-verdict ${trade ? "trade" : "wait"}`}>
              <span className="vx-td-badge">{trade ? "✓ TRADE" : "✋ WAIT"}</span>
              <p>{d.headline}</p>
              {trade && <span className="vx-td-grade-big">Grade {d.grade}</span>}
            </div>

            <div className="vx-td-flow">
              <Tf tf={`${d.bias.timeframe} bias`} direction={d.bias.direction} grade={d.bias.grade} />
              <span className="vx-td-arrow">→</span>
              <Tf tf={`${d.entry.timeframe} entry`} direction={d.entry.direction} grade={d.entry.grade} />
            </div>

            {trade && e && (
              <div className="vx-td-plan">
                {[["Entry", e.entry], ["Stop", e.stop_loss], ["TP1", e.tp1], ["TP2", e.tp2], ["TP3", e.tp3],
                  ["R:R", e.risk_reward_tp1 ? `1:${e.risk_reward_tp1}` : "—"]].map(([k, v]) => (
                  <div key={k} className="vx-td-lvl"><span>{k}</span><b>{v}</b></div>
                ))}
              </div>
            )}

            {e?.confluence_factors?.length > 0 && (
              <div className="vx-signal-factors">
                {e.confluence_factors.slice(0, 5).map((f) => <span key={f} className="vx-chip">{f}</span>)}
              </div>
            )}

            {d.session_context && (
              <p className="vx-muted vx-td-session">
                {d.session_context.label} · {d.session_context.advice}
              </p>
            )}

            <div className="vx-panel vx-td-rl">
              <span className="vx-eyebrow">Reinforcement learning</span>
              <p className="vx-muted">{d.rl_note}</p>
            </div>
          </>
        )}
        <p className="vx-fineprint">
          {loading ? "Updating… " : ""}Top-down analysis is educational, not financial advice.
          Confirm on your own chart and manage risk. Want the AI write-up?{" "}
          <Link className="vx-inline-link" to="/terminal">Open the AI Terminal →</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
