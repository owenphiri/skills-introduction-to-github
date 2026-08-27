// src/pages/EAs.jsx — Voltex EA Fleet (trading robots), advanced first
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { useI18n } from "../i18n";
import { Footer } from "../components/Footer";
import { easService } from "../services/hub";
import { Reveal } from "../components/Reveal";

function statusClass(s) {
  return s === "Live" ? "live" : s === "Beta" ? "beta" : "soon";
}

export default function EAs() {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  useEffect(() => { easService.fleet().then(setD).catch(() => {}); }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Voltex EA Fleet · Trading Robots</span>
          <h1>🤖 The EA Fleet</h1>
          <p className="vx-muted">{t("pg.eas.sub")}</p>
        </div>

        {d && (
          <div className="vx-slogan-band">
            <div className="vx-slogan-track">
              {[...d.slogans, ...d.slogans].map((s, i) => (
                <span key={i} className="vx-slogan">{s}<em>⚡</em></span>
              ))}
            </div>
          </div>
        )}

        {d && (
          <>
            <div className="vx-ea-grid">
              {d.eas.map((ea, i) => (
                <Reveal key={ea.id} delay={i * 50}>
                  <div className="vx-ea-card vx-hover-lift" style={{ "--ea-accent": ea.accent }}>
                    <div className="vx-ea-top">
                      <span className="vx-ea-tier">{ea.tier}</span>
                      <span className={`vx-ea-status ${statusClass(ea.status)}`}>{ea.status}</span>
                    </div>
                    <h3>{ea.name}{ea.self_optimizing && <span className="vx-ea-rl" title="Self-optimizing RL">🧠 RL</span>}</h3>
                    <p className="vx-ea-tagline">{ea.tagline}</p>
                    <p className="vx-muted">{ea.desc}</p>
                    <div className="vx-ea-meta">
                      <span>📈 {ea.markets.join(" · ")}</span>
                      <span>⏱ {ea.timeframe}</span>
                    </div>
                    <div className="vx-ea-highlights">
                      {ea.highlights.map((h) => <span key={h} className="vx-chip">{h}</span>)}
                    </div>
                    <Link to="/store" className="vx-btn-primary vx-btn-sm">
                      {ea.status === "Coming Soon" ? "Join waitlist" : "Get this EA"}
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>

            <h2 className="vx-section-title">🧩 Advanced indicators inside every EA</h2>
            <div className="vx-ind-grid">
              {d.indicators.map((ind) => (
                <div key={ind} className="vx-ind-chip">✓ {ind}</div>
              ))}
            </div>
          </>
        )}
        <p className="vx-fineprint">
          Automated trading carries a high risk of loss. Performance characteristics are
          illustrative and not a guarantee of future results. Educational technology, not advice.
        </p>
      </main>
      <Footer />
    </div>
  );
}
