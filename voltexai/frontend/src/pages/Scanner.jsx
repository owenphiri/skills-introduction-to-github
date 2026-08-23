// src/pages/Scanner.jsx — Voltex Scanner (continuous market scan)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { signalsService } from "../services/signals";

const TFS = ["M5", "M15", "M30", "H1", "H4"];

export default function Scanner() {
  const [timeframe, setTimeframe] = useState("M15");
  const [minConf, setMinConf] = useState(5);
  const [signals, setSignals] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = () => {
      setScanning(true);
      signalsService.board({ timeframe, minConfidence: minConf, limit: 24 })
        .then((d) => { if (alive) { setSignals(d.signals); setScanning(false); setLastScan(new Date()); } })
        .catch(() => alive && setScanning(false));
    };
    run();
    const t = setInterval(run, 9000);
    return () => { alive = false; clearInterval(t); };
  }, [timeframe, minConf]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛰️ Voltex Scanner</h1>
          <p className="vx-muted">
            The whole market, scanned continuously. Voltex Scanner ranks every
            instrument by confluence and surfaces the strongest setups right now.
          </p>
        </div>

        <div className="vx-scanner-bar">
          <div className={`vx-radar ${scanning ? "spinning" : ""}`}>
            <span className="vx-radar-sweep" />
            <span className="vx-radar-dot" />
          </div>
          <div className="vx-scanner-status">
            <b>{scanning ? "Scanning markets…" : `${signals.length} setups found`}</b>
            <small className="vx-muted">
              {lastScan ? `Updated ${lastScan.toLocaleTimeString()}` : "—"} · auto-refresh 9s
            </small>
          </div>
          <div className="vx-filters-right">
            <div className="vx-tf-toggle">
              {TFS.map((tf) => (
                <button key={tf} className={tf === timeframe ? "active" : ""} onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
            <label className="vx-conf-filter">Min conf {minConf}
              <input type="range" min="3" max="9" value={minConf} onChange={(e) => setMinConf(+e.target.value)} />
            </label>
          </div>
        </div>

        <div className="vx-signal-grid">
          {signals.map((s) => {
            const long = s.direction === "LONG";
            return (
              <Link to={`/trade?symbol=${s.symbol}&side=${long ? "buy" : "sell"}`}
                key={`${s.symbol}-${s.timeframe}`}
                className={`vx-scan-card vx-rise vx-scan-card--${long ? "long" : "short"}`}>
                <div className="vx-scan-top">
                  <b>{s.symbol}</b>
                  <span className={`vx-pill vx-pill--${long ? "long" : "short"}`}>{s.direction}</span>
                </div>
                <div className="vx-scan-conf">
                  <div className="vx-conf-fill" style={{ width: `${s.confidence * 10}%` }} />
                  <span>{s.confidence}/10</span>
                </div>
                <div className="vx-scan-meta">
                  <span className="vx-muted">{s.asset_class}</span>
                  <span className="vx-mono">R:R {s.risk_reward_tp3}</span>
                </div>
              </Link>
            );
          })}
          {!scanning && signals.length === 0 && (
            <div className="vx-empty-state">Market's quiet at this filter — lower the threshold or switch timeframe.</div>
          )}
        </div>
        <p className="vx-fineprint">Automated educational analysis, not financial advice.</p>
      </main>
      <Footer />
    </div>
  );
}
