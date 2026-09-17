// src/pages/Scanner.jsx — Voltex Scanner (wide-scope scan + risk-gated auto-execution)
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { signalsService } from "../services/signals";
import { autotradeService } from "../services/autotrade";
import { arbitrageService } from "../services/arbitrage";

const TFS = ["M5", "M15", "M30", "H1", "H4"];
const CLASSES = ["all", "forex", "metals", "energy", "indices", "crypto", "stocks", "synthetics", "futures"];

// Fee tiers a user can model. `undefined` = the honest default: standard retail
// taker fees, at which cross-venue arb essentially never nets positive.
const FEE_TIERS = [
  { id: "retail", label: "Retail taker", bps: undefined, note: "each venue's standard fee" },
  { id: "vip", label: "VIP / maker 2 bps", bps: 2, note: "high-volume maker tier" },
  { id: "pro", label: "Maker rebate 0 bps", bps: 0, note: "colocated / rebate desk" },
];

export default function Scanner() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "arb" ? "arb" : "signals";
  const setMode = (m) => setParams(m === "arb" ? { mode: "arb" } : {}, { replace: true });
  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛰️ Voltex Scanner</h1>
          <p className="vx-muted">
            {mode === "signals"
              ? "Wide-scope scan across CFDs, metals, futures, crypto & Deriv synthetic indices — surfacing higher-timeframe-confirmed quality trades, ready to auto-execute."
              : "Fee-aware cross-venue spread scanner. It subtracts real fees & slippage from every gross spread, so only a genuine net edge is ever flagged — which is rare and small. Paper-first."}
          </p>
        </div>
        <div className="vx-mode-toggle">
          <button className={mode === "signals" ? "active" : ""} onClick={() => setMode("signals")}>
            ⚡ Signals &amp; auto-trade
          </button>
          <button className={mode === "arb" ? "active" : ""} onClick={() => setMode("arb")}>
            🔀 Arbitrage &amp; spreads
          </button>
        </div>
        {mode === "signals" ? <SignalsView /> : <ArbitrageView />}
      </main>
      <Footer />
    </div>
  );
}

function SignalsView() {
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
    <>
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
            {auto?.config?.mode === "live"
              ? `Live Deriv routing is ON — trading a ${auto?.config?.allow_real ? "REAL" : "DEMO"} account via multiplier contracts.`
              : "Paper mode by default — no real money. Live Deriv routing unlocks with a broker token + explicit opt-in (demo account first; real trading needs a second flag)."}
            {" "}Every order passes the risk layer (max-open, per-trade risk, daily-loss limit,
            symbol allowlist, kill switch).
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
                {s.news_warning && (
                  <div className={`vx-scan-news ${s.news_warning.live ? "live" : ""}`}>
                    {s.news_warning.live
                      ? `🔴 ${s.news_warning.code} live — high volatility`
                      : `⚠️ ${s.news_warning.code} in ${s.news_warning.countdown}`}
                  </div>
                )}
                {s.liquidity && s.liquidity.zone && (
                  <div className="vx-scan-liq">
                    <span className={`vx-liq-zone vx-liq-zone--${s.liquidity.zone}`}>{s.liquidity.zone}</span>
                    {s.liquidity.likely_draw && (
                      <span className="vx-liq-draw">→ {s.liquidity.likely_draw} draw</span>
                    )}
                    {s.liquidity.sweep && (
                      <span className="vx-liq-sweep">✦ {s.liquidity.sweep} sweep → {s.liquidity.reversal_bias}</span>
                    )}
                    {typeof s.liquidity_score === "number" && (
                      <span className="vx-liq-score">liq {s.liquidity_score}/10</span>
                    )}
                  </div>
                )}
                {s.liquidity_warning && (
                  <div className="vx-scan-liqwarn">⚠ {s.liquidity_warning}</div>
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
    </>
  );
}

// ----------------------------- Arbitrage view -----------------------------
function ArbitrageView() {
  const [feeTier, setFeeTier] = useState("retail");
  const [notional, setNotional] = useState(10000);
  const [minNet, setMinNet] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [msg, setMsg] = useState("");
  const [running, setRunning] = useState(false);

  const tier = FEE_TIERS.find((f) => f.id === feeTier) || FEE_TIERS[0];

  useEffect(() => {
    let alive = true;
    const run = () => {
      setScanning(true);
      arbitrageService.scan({ minNetBps: minNet, notional, feeTierBps: tier.bps })
        .then((d) => { if (alive) { setData(d); setScanning(false); setLastScan(new Date()); } })
        .catch(() => alive && setScanning(false));
    };
    run();
    const id = setInterval(run, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [feeTier, notional, minNet]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    const poll = () => arbitrageService.status().then((s) => alive && setStatus(s)).catch(() => {});
    poll();
    const id = setInterval(poll, 12000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const runArb = () => {
    setRunning(true); setMsg("");
    arbitrageService.run({ minNetBps: minNet, notional, feeTierBps: tier.bps })
      .then((r) => {
        if (!r.ran) setMsg(r.reason || "Executor is off.");
        else setMsg(`Booked ${r.executed.length} paper pair(s) · skipped ${r.skipped.length}`);
        return arbitrageService.status().then(setStatus);
      })
      .catch((e) => setMsg(e.status === 401 || e.status === 403
        ? "Sign in to book paper arbitrage pairs."
        : (e.message || "Could not run the arbitrage cycle.")))
      .finally(() => setRunning(false));
  };

  const closePair = (id) => {
    arbitrageService.close(id)
      .then(() => arbitrageService.status().then(setStatus))
      .catch(() => {});
  };

  const opps = data?.opportunities || [];
  const actionable = opps.filter((o) => o.actionable);

  return (
    <>
      {/* Fee-honesty banner */}
      <div className={`vx-arb-banner ${actionable.length ? "hot" : ""}`}>
        {tier.bps === undefined
          ? "At standard retail taker fees, fees + slippage swallow every cross-venue spread — so nothing is actionable. That's the honest reality of retail arbitrage."
          : `Modelling a ${tier.label.toLowerCase()} (${tier.bps} bps/side). An edge only exists at institutional fee tiers — and even then it's small and fleeting.`}
      </div>

      {/* Paper executor panel */}
      <div className="vx-auto-panel">
        <div className="vx-auto-head">
          <div>
            <b>🔀 Paper spread executor</b>
            <span className="vx-auto-mode vx-auto-mode--paper">PAPER</span>
            {status && !status.gate_open && <span className="vx-auto-off">{status.enabled ? "gated" : "disabled"}</span>}
            {status?.kill_switch && <span className="vx-auto-kill">KILL SWITCH ON</span>}
          </div>
          <button className="vx-btn-primary vx-btn-sm" onClick={runArb} disabled={running}>
            {running ? "Running…" : "Book actionable pairs (paper) ↻"}
          </button>
        </div>
        <div className="vx-auto-stats">
          <div><span>Gate</span><b>{status?.gate_open ? "open" : "closed"}</b></div>
          <div><span>Open pairs</span><b>{status?.open_count ?? 0}/{status?.max_open ?? "—"}</b></div>
          <div><span>Realized (paper)</span><b>${status?.realized_usd ?? 0}</b></div>
          <div><span>Actionable now</span><b>{actionable.length}</b></div>
          <div><span>Slippage buffer</span><b>{status?.slippage_bps ?? "—"} bps</b></div>
          <div><span>Notional</span><b>${notional.toLocaleString()}</b></div>
        </div>
        {msg && <p className="vx-auto-msg">{msg}</p>}
        {status?.open_pairs?.length > 0 && (
          <div className="vx-arb-open">
            {status.open_pairs.map((p) => (
              <div key={p.id} className="vx-arb-open-row">
                <b>{p.symbol}</b>
                <span className="vx-muted">L {p.long_venue} / S {p.short_venue}</span>
                <span className="vx-mono">entry {p.net_bps} bps · now {p.current_net_bps ?? "—"} bps</span>
                <button className="vx-btn-secondary vx-btn-xs" onClick={() => closePair(p.id)}>Close</button>
              </div>
            ))}
          </div>
        )}
        <p className="vx-auto-note">
          Paper only — no real money. The executor reuses the auto-trader's guardrails
          (enable flag, kill switch, high-impact news guard, max-open) and books a
          fully-hedged long/short pair only when the net edge is positive.
        </p>
      </div>

      {/* Controls */}
      <div className="vx-scanner-bar">
        <div className={`vx-radar ${scanning ? "spinning" : ""}`}>
          <span className="vx-radar-sweep" />
          <span className="vx-radar-dot" />
        </div>
        <div className="vx-scanner-status">
          <b>{scanning ? "Scanning venues…" : `${opps.length} pairs · ${actionable.length} net-positive`}</b>
          <small className="vx-muted">{lastScan ? `Updated ${lastScan.toLocaleTimeString()}` : "—"} · auto-refresh 10s</small>
        </div>
        <div className="vx-filters-right">
          <div className="vx-tf-toggle">
            {FEE_TIERS.map((f) => (
              <button key={f.id} className={f.id === feeTier ? "active" : ""} onClick={() => setFeeTier(f.id)} title={f.note}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="vx-conf-filter">Min net {minNet} bps
            <input type="range" min="0" max="10" value={minNet} onChange={(e) => setMinNet(+e.target.value)} />
          </label>
        </div>
      </div>

      {/* Opportunities table */}
      <div className="vx-arb-table-wrap">
        <table className="vx-arb-table">
          <thead>
            <tr>
              <th>Symbol</th><th>Buy @</th><th>Sell @</th>
              <th>Gross</th><th>Fees</th><th>Net</th><th>Net $</th><th></th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => (
              <tr key={o.symbol} className={o.actionable ? "hot" : ""}>
                <td><b>{o.symbol}</b><small className="vx-muted"> {o.asset_class}</small></td>
                <td><span className="vx-mono">{o.buy_at}</span><small className="vx-muted"> {o.buy_venue}</small></td>
                <td><span className="vx-mono">{o.sell_at}</span><small className="vx-muted"> {o.sell_venue}</small></td>
                <td className={o.gross_bps >= 0 ? "vx-up" : "vx-down"}>{o.gross_bps} bps</td>
                <td className="vx-muted">{o.fee_bps} bps</td>
                <td className={o.net_bps >= 0 ? "vx-up" : "vx-down"}><b>{o.net_bps} bps</b></td>
                <td className={o.net_usd >= 0 ? "vx-up" : "vx-down"}>${o.net_usd}</td>
                <td>{o.actionable
                  ? <span className="vx-pill vx-pill--long">edge</span>
                  : <span className="vx-pill vx-pill--flat">no edge</span>}</td>
              </tr>
            ))}
            {!scanning && opps.length === 0 && (
              <tr><td colSpan="8" className="vx-muted" style={{ textAlign: "center", padding: "1.4rem" }}>
                No cross-listed pairs available right now.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Basis table */}
      {data?.basis?.length > 0 && (
        <div className="vx-arb-basis">
          <h3>Futures vs spot basis <small className="vx-muted">— carry relationship, not a free lunch</small></h3>
          <div className="vx-arb-basis-grid">
            {data.basis.map((b) => (
              <div key={b.future} className="vx-arb-basis-card">
                <div className="vx-arb-basis-top">
                  <b>{b.future}</b><span className="vx-muted">vs {b.spot}</span>
                </div>
                <div className={`vx-arb-basis-bps ${b.basis_bps >= 0 ? "vx-up" : "vx-down"}`}>
                  {b.basis_bps > 0 ? "+" : ""}{b.basis_bps} bps
                </div>
                <div className="vx-muted">{b.structure} · {b.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="vx-fineprint">{data?.disclaimer ||
        "Fee-aware, paper-first. Simulated results have inherent limitations (CFTC Rule 4.41). Not financial advice."}</p>
    </>
  );
}
