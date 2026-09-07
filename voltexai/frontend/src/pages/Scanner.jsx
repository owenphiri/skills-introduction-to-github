// src/pages/Scanner.jsx — Voltex Scanner (wide-scope scan + risk-gated auto-execution)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { useI18n } from "../i18n";
import { Footer } from "../components/Footer";
import { signalsService } from "../services/signals";
import { autotradeService } from "../services/autotrade";

const TFS = ["M5", "M15", "M30", "H1", "H4"];
const CLASSES = ["all", "forex", "metals", "energy", "indices", "crypto", "stocks", "synthetics", "futures"];

export default function Scanner() {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState("M15");
  const [assetClass, setAssetClass] = useState("all");
  const [quality, setQuality] = useState(true);
  const [minConf, setMinConf] = useState(5);
  const [signals, setSignals] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [lastScan, setLastScan] = useState(null);

  // auto-trader
  const [auto, setAuto] = useState(null);
  const [autoMsg, setAutoMsg] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = () => {
      setScanning(true);
      const req = quality
        ? signalsService.quality({ assetClass, timeframe, minGrade: "A", minRr: 1.5, limit: 30 })
        : signalsService.scan({ assetClass, timeframe, minConfidence: minConf });
      req.then((d) => { if (alive) { setSignals(d.signals || []); setScanning(false); setLastScan(new Date()); } })
        .catch(() => alive && setScanning(false));
    };
    run();
    const id = setInterval(run, 9000);
    return () => { alive = false; clearInterval(id); };
  }, [timeframe, assetClass, quality, minConf]);

  useEffect(() => {
    let alive = true;
    const poll = () => autotradeService.status().then((s) => alive && setAuto(s)).catch(() => {});
    poll();
    const id = setInterval(poll, 12000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const runAuto = () => {
    setRunning(true); setAutoMsg("");
    autotradeService.run({ assetClass, timeframe })
      .then((r) => {
        if (!r.ran) setAutoMsg(r.reason || "Auto-trader is off.");
        else setAutoMsg(`Executed ${r.executed.length} · skipped ${r.skipped.length} · ${r.mode.toUpperCase()}`);
        return autotradeService.status().then(setAuto);
      })
      .catch((e) => setAutoMsg(e.status === 401 || e.status === 403
        ? "Sign in to enable auto-execution (paper)."
        : (e.message || "Could not run auto-scan.")))
      .finally(() => setRunning(false));
  };

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛰️ Voltex Scanner</h1>
          <p className="vx-muted">
            Wide-scope scan across CFDs, metals, futures, crypto &amp; Deriv synthetic indices —
            surfacing higher-timeframe-confirmed quality trades, ready to auto-execute.
          </p>
        </div>

        {/* Auto-trader panel */}
        <div className="vx-auto-panel">
          <div className="vx-auto-head">
            <div>
              <b>⚡ Auto-Execution</b>
              <span className={`vx-auto-mode vx-auto-mode--${auto?.config?.mode || "paper"}`}>
                {(auto?.config?.mode || "paper").toUpperCase()}
              </span>
              {auto?.config?.kill_switch && <span className="vx-auto-kill">KILL SWITCH ON</span>}
              {!auto?.config?.enabled && <span className="vx-auto-off">disabled</span>}
            </div>
            <button className="vx-btn-primary vx-btn-sm" onClick={runAuto} disabled={running}>
              {running ? "Running…" : "Run auto-scan (paper) ↻"}
            </button>
          </div>
          <div className="vx-auto-stats">
            <div><span>Equity</span><b>${auto?.equity ?? "—"}</b></div>
            <div><span>Open</span><b>{auto?.open_positions ?? 0}/{auto?.config?.max_open ?? "—"}</b></div>
            <div><span>Unrealized</span><b>${auto?.unrealized ?? 0}</b></div>
            <div><span>Realized today</span><b>${auto?.realized_today ?? 0}</b></div>
            <div><span>Loss budget</span><b>${auto?.daily_loss_budget_remaining ?? "—"}</b></div>
            <div><span>Grade ≥</span><b>{auto?.config?.min_grade ?? "A"} · RR {auto?.config?.min_rr ?? "—"}</b></div>
          </div>
          {autoMsg && <p className="vx-auto-msg">{autoMsg}</p>}
          <p className="vx-auto-note">
            Paper mode by default — no real money. Live Deriv routing unlocks after KYC/MOU and an
            explicit operator opt-in. Every order passes the risk layer (max-open, per-trade risk,
            daily-loss limit, symbol allowlist, kill switch).
          </p>
        </div>

        <div className="vx-scanner-bar">
          <div className={`vx-radar ${scanning ? "spinning" : ""}`}>
            <span className="vx-radar-sweep" />
            <span className="vx-radar-dot" />
          </div>
          <div className="vx-scanner-status">
            <b>{scanning ? "Scanning markets…" : `${signals.length} ${quality ? "quality trades" : "setups"} found`}</b>
            <small className="vx-muted">
              {lastScan ? `Updated ${lastScan.toLocaleTimeString()}` : "—"} · auto-refresh 9s
            </small>
          </div>
          <div className="vx-filters-right">
            <button className={`vx-quality-toggle ${quality ? "on" : ""}`} onClick={() => setQuality((q) => !q)}>
              {quality ? "★ Quality only" : "All setups"}
            </button>
            <div className="vx-tf-toggle">
              {TFS.map((tf) => (
                <button key={tf} className={tf === timeframe ? "active" : ""} onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
            {!quality && (
              <label className="vx-conf-filter">Min conf {minConf}
                <input type="range" min="3" max="9" value={minConf} onChange={(e) => setMinConf(+e.target.value)} />
              </label>
            )}
          </div>
        </div>

        <div className="vx-class-tabs vx-class-tabs--scanner">
          {CLASSES.map((c) => (
            <button key={c} className={c === assetClass ? "active" : ""} onClick={() => setAssetClass(c)}>{c}</button>
          ))}
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
                  <span className="vx-scan-badges">
                    {s.grade && <span className={`vx-grade vx-grade--${(s.grade || "").replace("+", "p")}`}>{s.grade}</span>}
                    <span className={`vx-pill vx-pill--${long ? "long" : "short"}`}>{s.direction}</span>
                  </span>
                </div>
                <div className="vx-scan-conf">
                  <div className="vx-conf-fill" style={{ width: `${s.confidence * 10}%` }} />
                  <span>{s.confidence}/10</span>
                </div>
                <div className="vx-scan-meta">
                  <span className="vx-muted">{s.asset_class}</span>
                  <span className="vx-mono">R:R {s.risk_reward_tp3}</span>
                </div>
                {s.htf_bias && (
                  <div className="vx-scan-htf">
                    <span className={`vx-dot ${s.htf_aligned ? "ok" : "warn"}`} />
                    {s.htf_timeframe} bias {s.htf_bias === "NO_TRADE" ? "neutral" : s.htf_bias}
                  </div>
                )}
              </Link>
            );
          })}
          {!scanning && signals.length === 0 && (
            <div className="vx-empty-state">
              {quality ? "No quality trades clear the filter right now — the scanner stays patient."
                : "Market's quiet at this filter — lower the threshold or switch timeframe."}
            </div>
          )}
        </div>
        <p className="vx-fineprint">Automated educational analysis, not financial advice. Auto-execution defaults to paper.</p>
      </main>
      <Footer />
    </div>
  );
}
