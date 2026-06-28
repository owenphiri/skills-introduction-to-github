// src/pages/PropFirms.jsx — prop-firm comparison directory
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { directoryService } from "../services/directory";

const CLASSES = ["all", "forex", "indices", "metals", "crypto", "stocks"];

export default function PropFirms() {
  const [assetClass, setAssetClass] = useState("all");
  const [firms, setFirms] = useState([]);

  useEffect(() => {
    directoryService.propFirms(assetClass).then((d) => setFirms(d.firms)).catch(() => {});
  }, [assetClass]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Prop Firms</h1>
          <p className="vx-muted">
            Get funded and trade size with other people's capital. Compare evaluation models,
            payout splits and rules — then let VoltexAI keep you inside the risk limits.
          </p>
        </div>

        <div className="vx-class-tabs">
          {CLASSES.map((c) => (
            <button key={c} className={c === assetClass ? "active" : ""}
              onClick={() => setAssetClass(c)}>{c}</button>
          ))}
        </div>

        <div className="vx-card-grid">
          {firms.map((f) => (
            <div key={f.id} className="vx-dir-card">
              <div className="vx-dir-head">
                <div>
                  <h3>{f.name}</h3>
                  <span className="vx-muted">{f.country} · est. {f.founded}</span>
                </div>
                <span className="vx-rating">★ {f.rating}</span>
              </div>
              <p className="vx-dir-model">{f.model}</p>
              <div className="vx-dir-stats">
                <div><span>Max funding</span><b>${(f.max_funding_usd / 1000).toLocaleString()}K</b></div>
                <div><span>Profit split</span><b>{f.profit_split}</b></div>
                <div><span>Targets</span><b>{f.profit_target}</b></div>
                <div><span>Daily DD</span><b>{f.max_daily_loss}</b></div>
                <div><span>Max DD</span><b>{f.max_overall_loss}</b></div>
                <div><span>Payouts</span><b>{f.payout_cycle}</b></div>
              </div>
              <div className="vx-dir-tags">
                {f.ea_allowed && <span className="vx-chip vx-chip--ok">EAs OK</span>}
                {f.news_trading && <span className="vx-chip vx-chip--ok">News OK</span>}
                {f.weekend_holding && <span className="vx-chip vx-chip--ok">Weekend hold</span>}
                {f.platforms.slice(0, 3).map((p) => <span key={p} className="vx-chip">{p}</span>)}
              </div>
              <p className="vx-dir-best">{f.best_for}</p>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="vx-btn-secondary vx-btn-sm">Visit {f.name} ↗</a>
            </div>
          ))}
        </div>
        <p className="vx-fineprint">
          Editorial reference only — not an endorsement. Confirm current rules and pricing on
          each firm's website. VoltexAI may earn partner referral fees.
        </p>
      </main>
    </div>
  );
}
