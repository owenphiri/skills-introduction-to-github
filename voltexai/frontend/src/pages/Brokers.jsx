// src/pages/Brokers.jsx — regulated broker directory (Africa-friendly first)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { directoryService } from "../services/directory";

const CLASSES = ["all", "forex", "metals", "energy", "indices", "crypto", "stocks"];

export default function Brokers() {
  const [assetClass, setAssetClass] = useState("all");
  const [africaOnly, setAfricaOnly] = useState(false);
  const [brokers, setBrokers] = useState([]);

  useEffect(() => {
    directoryService.brokers({ assetClass, africaOnly })
      .then((d) => setBrokers(d.brokers)).catch(() => {});
  }, [assetClass, africaOnly]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Brokers</h1>
          <p className="vx-muted">
            Regulated brokers with the spreads, leverage and funding rails that matter —
            including M-Pesa and local-bank deposits for African traders.
          </p>
        </div>

        <div className="vx-filters">
          <div className="vx-class-tabs">
            {CLASSES.map((c) => (
              <button key={c} className={c === assetClass ? "active" : ""}
                onClick={() => setAssetClass(c)}>{c}</button>
            ))}
          </div>
          <label className="vx-switch">
            <input type="checkbox" checked={africaOnly}
              onChange={(e) => setAfricaOnly(e.target.checked)} />
            Africa-friendly only
          </label>
        </div>

        <div className="vx-card-grid">
          {brokers.map((b) => (
            <div key={b.id} className="vx-dir-card">
              <div className="vx-dir-head">
                <div>
                  <h3>{b.name}</h3>
                  <span className="vx-muted">{b.regulators.join(" · ")}</span>
                </div>
                <span className="vx-rating">★ {b.rating}</span>
              </div>
              <div className="vx-dir-stats">
                <div><span>Min deposit</span><b>${b.min_deposit_usd}</b></div>
                <div><span>Max leverage</span><b>{b.max_leverage}</b></div>
                <div><span>EUR/USD</span><b>{b.spread_eurusd_pips} pips</b></div>
                <div><span>Commission</span><b>{b.commission}</b></div>
              </div>
              <div className="vx-dir-tags">
                {b.africa_friendly && <span className="vx-chip vx-chip--accent">Africa-friendly</span>}
                {b.instant_withdrawals && <span className="vx-chip vx-chip--ok">Instant withdrawals</span>}
                {b.platforms.slice(0, 3).map((p) => <span key={p} className="vx-chip">{p}</span>)}
              </div>
              <div className="vx-dir-funding">
                <span className="vx-muted">Funding:</span> {b.funding.join(" · ")}
              </div>
              <p className="vx-dir-best">{b.best_for}</p>
              <a href={b.url} target="_blank" rel="noopener noreferrer"
                className="vx-btn-secondary vx-btn-sm">Visit {b.name} ↗</a>
            </div>
          ))}
        </div>
        <p className="vx-fineprint">
          Editorial reference only. Verify regulation status and current terms before depositing.
          VoltexAI does not hold client funds and may earn partner referral fees.
        </p>
      </main>
    </div>
  );
}
