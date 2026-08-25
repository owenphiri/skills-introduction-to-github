// src/pages/SignalsPro.jsx — Voltex Signals Pro (managed A+ signal feed)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { Reveal } from "../components/Reveal";
import { proSignalsService } from "../services/hub";

function Ring({ score }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 90 ? "var(--vx-success)" : score >= 80 ? "var(--vx-accent)"
    : score >= 70 ? "var(--vx-warn)" : "var(--vx-danger)";
  return (
    <svg className="vx-ring" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--vx-border)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * pct).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 32 32)" />
      <text x="32" y="35" textAnchor="middle" className="vx-ring-text" fill={color}>{Math.round(score)}</text>
    </svg>
  );
}

const GRADE = { "A+": "🔥", "A": "🟢", "B": "🟡" };
const STATUS_LABEL = {
  active: "ACTIVE", filled: "FILLED", tp1: "TP1 ✓", tp2: "TP2 ✓", tp3: "TP3 ✓",
  tp4: "TP4 ✓", be: "BREAK-EVEN", closed: "CLOSED", cancelled: "CANCELLED",
};

function SignalCard({ s }) {
  const dir = s.direction === "buy" ? "buy" : "sell";
  return (
    <div className={`vx-sig-card ${s.locked ? "locked" : ""}`}>
      <div className="vx-sig-top">
        <div>
          <span className="vx-sig-grade">{GRADE[s.grade] || "•"} {s.grade}</span>
          <h3>{s.symbol} <span className={`vx-sig-dir ${dir}`}>{s.direction.toUpperCase()}</span></h3>
          <span className="vx-muted">{s.timeframe || "—"} · {s.strategy}{s.session ? ` · ${s.session}` : ""}</span>
        </div>
        <Ring score={s.quality_score} />
      </div>

      <div className="vx-sig-levels">
        <div className="vx-sig-lvl"><span>Entry</span><b>{s.entry ?? "—"}</b></div>
        <div className="vx-sig-lvl"><span>SL</span><b>{s.sl ?? "🔒"}</b></div>
        <div className="vx-sig-lvl up"><span>TP1</span><b>{s.tp1 ?? "—"}</b></div>
        <div className="vx-sig-lvl up"><span>TP2</span><b>{s.tp2 ?? "🔒"}</b></div>
        <div className="vx-sig-lvl up"><span>TP3</span><b>{s.tp3 ?? "🔒"}</b></div>
        <div className="vx-sig-lvl up"><span>TP4</span><b>{s.tp4 ?? "🔒"}</b></div>
      </div>

      <div className="vx-sig-foot">
        <span className="vx-chip">RR 1:{s.risk_reward}</span>
        <span className={`vx-sig-status s-${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
        {s.result_r != null && (
          <span className={s.result_r >= 0 ? "vx-up" : "vx-down"}>{s.result_r >= 0 ? "+" : ""}{s.result_r}R</span>
        )}
      </div>

      {s.locked && (
        <Link to="/pricing" className="vx-sig-lock">
          🔒 Unlock full entry zone, SL &amp; TP2–TP4 — <b>Go VIP</b>
        </Link>
      )}
    </div>
  );
}

export default function SignalsPro() {
  const [feed, setFeed] = useState(null);
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    const load = () => {
      proSignalsService.feed(24).then(setFeed).catch(() => {});
      proSignalsService.performance().then(setPerf).catch(() => {});
    };
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Voltex Signals Pro · TradingView → AI → VIP</span>
          <h1>🎯 A+ Signals, Nothing Less</h1>
          <p className="vx-muted">
            Every setup is scored 0–100 by the Voltex engine — weak signals are auto-rejected.
            Free traders see the preview; VIP gets the full entry zone, SL, TP1–TP4 and live management.
          </p>
        </div>

        {perf && (
          <div className="vx-perf-strip">
            <div className="vx-perf"><b>{perf.win_rate}%</b><span>Win rate</span></div>
            <div className="vx-perf"><b>{perf.profit_factor}</b><span>Profit factor</span></div>
            <div className="vx-perf"><b className="vx-up">{perf.total_r >= 0 ? "+" : ""}{perf.total_r}R</b><span>Total R</span></div>
            <div className="vx-perf"><b>{perf.total_signals}</b><span>Signals</span></div>
            <div className="vx-perf"><b>{perf.best_pair || "—"}</b><span>Best pair</span></div>
            <div className="vx-perf"><b>{perf.active}</b><span>Live now</span></div>
          </div>
        )}

        {feed && !feed.is_vip && (
          <div className="vx-vip-banner">
            <div>
              <b>You're on the free preview.</b>
              <span className="vx-muted"> Unlock every entry, SL &amp; TP2–TP4 + Telegram VIP + MT5 auto-execution.</span>
            </div>
            <Link to="/pricing" className="vx-btn-primary vx-btn-sm">Become VIP 💎</Link>
          </div>
        )}

        {!feed && <p className="vx-muted">Loading the signal desk…</p>}
        {feed && feed.signals.length === 0 && (
          <p className="vx-muted">No signals published yet — the desk posts A+ setups as they trigger.</p>
        )}

        <div className="vx-sig-grid">
          {feed?.signals.map((s, i) => (
            <Reveal key={s.uuid} delay={i * 40}><SignalCard s={s} /></Reveal>
          ))}
        </div>

        <a className="vx-tg-cta" href="https://t.me/VoltexAIForexBot" target="_blank" rel="noopener noreferrer">
          <div>
            <b>📲 Get signals on Telegram</b>
            <span className="vx-muted">Free channel + VIP with full setups & MT5 auto-execution. Subscribe with Telegram Stars ⭐.</span>
          </div>
          <span className="vx-btn-primary vx-btn-sm">Open @VoltexAIForexBot →</span>
        </a>

        {perf?.week && (
          <div className="vx-week-report">
            <h3>📊 This week</h3>
            <p>{perf.week.signals} signals · {perf.week.wins} wins ·
              <b className={perf.week.net_r >= 0 ? "vx-up" : "vx-down"}> {perf.week.net_r >= 0 ? "+" : ""}{perf.week.net_r}R</b></p>
          </div>
        )}
        <p className="vx-fineprint">
          Signals are educational analysis, not financial advice. Past performance does not
          guarantee future results. Trading leveraged products carries a high risk of loss.
        </p>
      </main>
      <Footer />
    </div>
  );
}
