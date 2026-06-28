// src/pages/Landing.jsx — public marketing front door
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Sparkline } from "../components/Chart";
import { marketsService } from "../services/markets";
import { signalsService } from "../services/signals";

const FEATURES = [
  { icon: "🧠", title: "AI Trading Terminal",
    body: "Claude-powered terminal with four modes — chat, structured analysis, JSON signals and an ICT/SMC academy that teaches as you trade." },
  { icon: "📈", title: "Live Markets",
    body: "Forex, metals, energy, indices, crypto and US equities streaming in real time with candlesticks and movers." },
  { icon: "⚡", title: "Algorithmic Signals",
    body: "A quant scanner blends EMA, RSI, MACD, Bollinger and market structure into ranked, risk-bracketed trade ideas." },
  { icon: "👁️", title: "Chart Vision",
    body: "Upload a screenshot — VoltexAI reads structure, liquidity and order blocks and writes the full trade plan." },
  { icon: "🏦", title: "Prop Firms & Brokers",
    body: "Compare FTMO, FundedNext, FundingPips and Africa-friendly brokers with mobile-money funding side by side." },
  { icon: "💼", title: "Managed Alpha (AUM)",
    body: "Hands-off? Allocate to the VoltexAI managed program — segregated accounts, real-time investor dashboard." },
];

const STEPS = [
  ["Create your account", "Sign up free in 30 seconds — email and a password, no card."],
  ["Learn the method", "Master ICT/SMC and risk in the Academy mode, built on Owens Forex Academy."],
  ["Scan & analyse", "Pull live signals and AI breakdowns across every market, every session."],
  ["Pay your way", "Upgrade with card (Stripe) or mobile money (MTN, Airtel, M-Pesa via Flutterwave)."],
];

export default function Landing() {
  const [movers, setMovers] = useState({ gainers: [], losers: [] });
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    marketsService.movers(4).then(setMovers).catch(() => {});
    signalsService.board({ minConfidence: 3, limit: 4 })
      .then((d) => setSignals(d.signals)).catch(() => {});
  }, []);

  return (
    <div className="vx-page vx-landing">
      <NavBar />

      <section className="vx-hero">
        <div className="vx-hero-copy">
          <span className="vx-eyebrow">PrimeAxis ICT · Owens Forex Academy</span>
          <h1>Africa's <span className="vx-grad">AI trading terminal.</span></h1>
          <p className="vx-hero-sub">
            Live markets, powerful AI signals, chart vision, prop-firm & broker intel,
            and a managed-alpha program — built Africa-first with mobile-money payments.
          </p>
          <div className="vx-hero-cta">
            <Link to="/signup" className="vx-btn-primary vx-btn-lg">Start free</Link>
            <Link to="/markets" className="vx-btn-secondary vx-btn-lg">View live markets</Link>
          </div>
          <p className="vx-hero-tag">⚡ Trade Smart · Trade Safe · Trade Consistently</p>
        </div>

        <aside className="vx-hero-panel">
          <div className="vx-panel-head"><b>Live signal board</b><span className="vx-live-dot">LIVE</span></div>
          {signals.length === 0 && <p className="vx-muted">Scanning markets…</p>}
          {signals.map((s) => (
            <div key={s.symbol} className="vx-mini-signal">
              <div>
                <b>{s.symbol}</b>
                <span className={`vx-pill vx-pill--${s.direction === "LONG" ? "long" : "short"}`}>
                  {s.direction}
                </span>
              </div>
              <div className="vx-mini-signal-meta">
                <span>conf {s.confidence}/10</span>
                <span>R:R {s.risk_reward_tp1}</span>
              </div>
            </div>
          ))}
          <Link to="/signals" className="vx-panel-link">Open the scanner →</Link>
        </aside>
      </section>

      <section className="vx-movers-strip">
        {[...movers.gainers, ...movers.losers].map((q, i) => (
          <div key={i} className="vx-mover">
            <Sparkline data={[q.day_low, q.price, q.day_high, q.price]} up={q.change_pct >= 0} />
            <div>
              <b>{q.symbol}</b>
              <span className={q.change_pct >= 0 ? "vx-up" : "vx-down"}>
                {q.change_pct >= 0 ? "+" : ""}{q.change_pct}%
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="vx-section">
        <h2 className="vx-section-title">Everything a serious trader needs</h2>
        <div className="vx-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="vx-feature-card">
              <span className="vx-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="vx-section vx-section--alt">
        <h2 className="vx-section-title">From zero to consistent in four steps</h2>
        <div className="vx-steps">
          {STEPS.map(([t, b], i) => (
            <div key={t} className="vx-step">
              <span className="vx-step-num">{i + 1}</span>
              <h4>{t}</h4>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="vx-cta-band">
        <h2>Ready to trade with an edge?</h2>
        <p>Join traders across Zambia, Nigeria, Kenya, Ghana and South Africa.</p>
        <div className="vx-hero-cta">
          <Link to="/signup" className="vx-btn-primary vx-btn-lg">Create free account</Link>
          <Link to="/aum" className="vx-btn-ghost vx-btn-lg">Explore managed AUM</Link>
        </div>
      </section>

      <footer className="vx-footer">
        <div>
          <b>VoltexAI</b> — by PrimeAxis ICT Trade & Solutions Ltd · Kasama, Zambia.
          Methodology by Owens Forex Academy.
        </div>
        <div className="vx-footer-disclaimer">
          Trading leveraged products carries a high risk of loss. VoltexAI provides
          technology and educational analysis, not personalised investment advice.
        </div>
      </footer>
    </div>
  );
}
