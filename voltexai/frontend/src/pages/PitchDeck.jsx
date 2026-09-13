// src/pages/PitchDeck.jsx — animated investor / CEO pitch deck (sliding transitions)
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

const SLIDES = [
  { tone: "title", eyebrow: "Axion Labs Technologies · Investor & CEO Deck",
    title: "VoltexAI", accent: "Africa's AI Trading Terminal",
    lines: ["From Kasama, Zambia — to the world.",
            "Presented by OP Owens Phiri · Founder & CEO"],
    kicker: "Methodology powered by Owens Forex Academy" },
  { tone: "problem", eyebrow: "The problem",
    title: "Most traders lose — alone, and in the dark",
    lines: ["Retail traders lack institutional tools, discipline and real-time intelligence.",
            "Signals are noisy, education is scattered, and news wrecks accounts.",
            "Africa is under-served by global platforms and local funding rails."],
    stat: { k: "70–90%", v: "of retail traders lose money" } },
  { tone: "solution", eyebrow: "The solution",
    title: "One AI terminal for the whole journey",
    lines: ["VoltexAI unifies live markets, an AI terminal, a quant scanner, risk-gated automation and an academy — in one place.",
            "Built for African realities: mobile-money rails, local sessions, low minimums.",
            "World-class engineering, locally grounded."],
    stat: { k: "1", v: "platform, every edge" } },
  { tone: "product", eyebrow: "The ecosystem",
    title: "Products that compound",
    lines: ["Terminal · Markets · Signals & Scanner (CFDs, metals, futures, crypto, Deriv synthetics).",
            "Risk-gated Auto-Trade with a news guard · Chart Vision · Trade Journal.",
            "Academy · Community · Real Estate · Voltex Pay · Voltex Coin rewards."],
    stat: { k: "20+", v: "integrated modules" } },
  { tone: "edge", eyebrow: "How our traders win",
    title: "Quality over noise",
    lines: ["Every signal graded A+/A/B with higher-timeframe confirmation.",
            "Per-signal “news soon” warnings; the auto-trader pauses through CPI, NFP & FOMC.",
            "Discipline by design — position sizing, daily-loss limits, kill switch."],
    stat: { k: "A+", v: "only the cleanest setups" } },
  { tone: "traction", eyebrow: "Traction",
    title: "A community that's winning",
    lines: ["Verified client wins scrolling across the platform, moderated for authenticity.",
            "Growing subscriber base across Africa, UK, UAE, India and beyond.",
            "Broker & prop-firm partnerships (Deriv, XM, Exness, Weltrade, FundedNext)."],
    stat: { k: "🌍", v: "traders on every continent" } },
  { tone: "market", eyebrow: "The opportunity",
    title: "A young, mobile-first, digitising market",
    lines: ["Africa: fastest-growing trading population, mature mobile-money rails.",
            "Global reach for synthetics that trade 24/7/365.",
            "Prop-firm & funded-trading boom expands our top of funnel."],
    stat: { k: "$Bn+", v: "addressable across FX, CFDs & funded trading" } },
  { tone: "model", eyebrow: "Business model",
    title: "Multiple, compounding revenue lines",
    lines: ["SaaS subscriptions (5-tier ladder, monthly & annual).",
            "Affiliate commissions (brokers & prop firms) · Store · Academy.",
            "Managed Alpha (AUM) · Voltex Pay · Voltex Coin economy."],
    stat: { k: "5", v: "revenue engines" } },
  { tone: "team", eyebrow: "Team & vision",
    title: "Built by a trader-engineer",
    lines: ["OP Owens Phiri — Founder & CEO, Axion Labs Technologies.",
            "Owens Forex Academy methodology at the core.",
            "Mission: put institutional-grade tools in every African trader's hands."],
    kicker: "Engineering Zambia's digital future" },
  { tone: "ask", eyebrow: "The ask",
    title: "Join the movement",
    lines: ["Partner, invest, or start trading smarter today.",
            "Let's scale VoltexAI across the continent and beyond."],
    cta: true },
];

export default function PitchDeck() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState("next");
  const [playing, setPlaying] = useState(true);
  const n = SLIDES.length;

  const go = useCallback((to, d) => { setDir(d); setI(((to % n) + n) % n); }, [n]);
  const next = useCallback(() => go(i + 1, "next"), [i, go]);
  const prev = useCallback(() => go(i - 1, "prev"), [i, go]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((v) => { setDir("next"); return (v + 1) % n; }), 7000);
    return () => clearInterval(t);
  }, [playing, n]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const s = SLIDES[i];

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🎬 VoltexAI Pitch Deck</h1>
          <p className="vx-muted">The story of VoltexAI — use ← → arrows, space to pause, or let it play.</p>
        </div>

        <div className="vx-deck" onMouseEnter={() => setPlaying(false)} onMouseLeave={() => setPlaying(true)}>
          <div className={`vx-deck-stage tone-${s.tone}`}>
            <article key={i} className={`vx-slide enter-${dir}`}>
              <span className="vx-slide-eyebrow">{s.eyebrow}</span>
              <h2 className="vx-slide-title">
                {s.title}{s.accent && <><br /><span className="vx-grad">{s.accent}</span></>}
              </h2>
              <div className="vx-slide-body">
                {s.lines.map((l, k) => <p key={k}>{l}</p>)}
              </div>
              {s.stat && (
                <div className="vx-slide-stat"><b>{s.stat.k}</b><span>{s.stat.v}</span></div>
              )}
              {s.kicker && <p className="vx-slide-kicker">{s.kicker}</p>}
              {s.cta && (
                <div className="vx-slide-cta">
                  <Link to="/signup" className="vx-btn-primary vx-btn-lg">Start free</Link>
                  <Link to="/contact" className="vx-btn-secondary vx-btn-lg">Partner / invest</Link>
                </div>
              )}
              <span className="vx-slide-no">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
            </article>

            <button className="vx-deck-nav prev" onClick={prev} aria-label="Previous slide">‹</button>
            <button className="vx-deck-nav next" onClick={next} aria-label="Next slide">›</button>
            <div className="vx-deck-progress"><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
          </div>

          <div className="vx-deck-dots">
            {SLIDES.map((_, k) => (
              <button key={k} className={k === i ? "active" : ""} aria-label={`Go to slide ${k + 1}`}
                onClick={() => go(k, k > i ? "next" : "prev")} />
            ))}
            <button className="vx-deck-play" onClick={() => setPlaying((p) => !p)}>
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
