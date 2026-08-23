// src/pages/Calculators.jsx — advanced, hassle-free trading calculators
import { useMemo, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : "—";

// pip size heuristic: JPY pairs 0.01, metals/indices 0.1 handled via override
function PositionSize() {
  const [f, setF] = useState({ balance: "1000", risk: "1", stop: "20", pipValue: "10" });
  const r = useMemo(() => {
    const riskAmt = num(f.balance) * num(f.risk) / 100;
    const perLot = num(f.stop) * num(f.pipValue);
    const lots = perLot > 0 ? riskAmt / perLot : 0;
    return { riskAmt, lots };
  }, [f]);
  return (
    <div className="vx-calc">
      <h3>📐 Position Size / Lot Sizing</h3>
      <p className="vx-muted">Never risk more than you planned. Get the exact lot size from your risk.</p>
      <div className="vx-calc-fields">
        <label>Account balance ($)<input type="number" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })} /></label>
        <label>Risk %<input type="number" value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })} /></label>
        <label>Stop loss (pips)<input type="number" value={f.stop} onChange={(e) => setF({ ...f, stop: e.target.value })} /></label>
        <label>Pip value / lot ($)<input type="number" value={f.pipValue} onChange={(e) => setF({ ...f, pipValue: e.target.value })} /></label>
      </div>
      <div className="vx-calc-out">
        <div><span>Risk amount</span><b>${fmt(r.riskAmt)}</b></div>
        <div className="vx-calc-hero"><span>Lot size</span><b>{fmt(r.lots, 2)}</b></div>
      </div>
    </div>
  );
}

function RiskReward() {
  const [f, setF] = useState({ entry: "1.1000", stop: "1.0950", target: "1.1150", side: "buy" });
  const r = useMemo(() => {
    const e = num(f.entry), s = num(f.stop), t = num(f.target);
    const risk = Math.abs(e - s), reward = Math.abs(t - e);
    const rr = risk > 0 ? reward / risk : 0;
    const valid = f.side === "buy" ? (s < e && t > e) : (s > e && t < e);
    return { risk, reward, rr, valid };
  }, [f]);
  return (
    <div className="vx-calc">
      <h3>⚖️ Risk / Reward — Entry & Exit</h3>
      <p className="vx-muted">Plan the entry, stop and target — see your R multiple before you click.</p>
      <div className="vx-calc-fields">
        <label>Side
          <select value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}>
            <option value="buy">Buy</option><option value="sell">Sell</option>
          </select>
        </label>
        <label>Entry<input type="number" step="any" value={f.entry} onChange={(e) => setF({ ...f, entry: e.target.value })} /></label>
        <label>Stop loss<input type="number" step="any" value={f.stop} onChange={(e) => setF({ ...f, stop: e.target.value })} /></label>
        <label>Target<input type="number" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></label>
      </div>
      <div className="vx-calc-out">
        <div><span>Risk (dist)</span><b>{fmt(r.risk, 5)}</b></div>
        <div><span>Reward (dist)</span><b>{fmt(r.reward, 5)}</b></div>
        <div className="vx-calc-hero"><span>R:R</span><b className={r.rr >= 2 ? "vx-up" : ""}>1:{fmt(r.rr, 2)}</b></div>
      </div>
      {!r.valid && <p className="vx-down vx-calc-warn">⚠ Stop/target are on the wrong side for a {f.side}.</p>}
    </div>
  );
}

function Fibonacci() {
  const [f, setF] = useState({ high: "1.1200", low: "1.1000", dir: "up" });
  const rows = useMemo(() => {
    const hi = num(f.high), lo = num(f.low), range = hi - lo;
    const retr = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1];
    const ext = [1.272, 1.414, 1.618, 2.0, 2.618];
    const level = (r, extension = false) => f.dir === "up"
      ? (extension ? hi + range * (r - 1) : hi - range * r)
      : (extension ? lo - range * (r - 1) : lo + range * r);
    return {
      retr: retr.map((r) => ({ r, price: level(r) })),
      ext: ext.map((r) => ({ r, price: level(r, true) })),
    };
  }, [f]);
  return (
    <div className="vx-calc vx-calc--wide">
      <h3>🌀 Fibonacci — Retracement & Extension</h3>
      <p className="vx-muted">Drop your swing high & low. OTE zone (0.618–0.786) is highlighted.</p>
      <div className="vx-calc-fields">
        <label>Swing high<input type="number" step="any" value={f.high} onChange={(e) => setF({ ...f, high: e.target.value })} /></label>
        <label>Swing low<input type="number" step="any" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></label>
        <label>Direction
          <select value={f.dir} onChange={(e) => setF({ ...f, dir: e.target.value })}>
            <option value="up">Up (long)</option><option value="down">Down (short)</option>
          </select>
        </label>
      </div>
      <div className="vx-fib-grid">
        <div>
          <h4>Retracement</h4>
          {rows.retr.map((x) => (
            <div key={x.r} className={`vx-fib-row ${x.r >= 0.618 && x.r <= 0.786 ? "ote" : ""}`}>
              <span>{(x.r * 100).toFixed(1)}%</span><b>{fmt(x.price, 5)}</b>
            </div>
          ))}
        </div>
        <div>
          <h4>Extension (targets)</h4>
          {rows.ext.map((x) => (
            <div key={x.r} className="vx-fib-row ext"><span>{(x.r * 100).toFixed(1)}%</span><b>{fmt(x.price, 5)}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipValue() {
  const [f, setF] = useState({ lots: "1", pipSize: "0.0001", contract: "100000", quoteToUsd: "1" });
  const r = useMemo(() => {
    const v = num(f.lots) * num(f.contract) * num(f.pipSize) * num(f.quoteToUsd);
    return { v };
  }, [f]);
  return (
    <div className="vx-calc">
      <h3>💵 Pip Value</h3>
      <p className="vx-muted">Know exactly what each pip is worth for your size.</p>
      <div className="vx-calc-fields">
        <label>Lots<input type="number" step="any" value={f.lots} onChange={(e) => setF({ ...f, lots: e.target.value })} /></label>
        <label>Pip size<input type="number" step="any" value={f.pipSize} onChange={(e) => setF({ ...f, pipSize: e.target.value })} /></label>
        <label>Contract size<input type="number" step="any" value={f.contract} onChange={(e) => setF({ ...f, contract: e.target.value })} /></label>
        <label>Quote→USD<input type="number" step="any" value={f.quoteToUsd} onChange={(e) => setF({ ...f, quoteToUsd: e.target.value })} /></label>
      </div>
      <div className="vx-calc-out">
        <div className="vx-calc-hero"><span>Value / pip</span><b>${fmt(r.v, 2)}</b></div>
      </div>
    </div>
  );
}

export default function Calculators() {
  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Trader Toolkit</span>
          <h1>🧮 Advanced Trading Calculators</h1>
          <p className="vx-muted">Measure and place trades hassle-free — lot sizing, entries &amp; exits,
            Fibonacci and pip value. All instant, all in your browser.</p>
        </div>
        <div className="vx-calc-grid">
          <PositionSize />
          <RiskReward />
          <Fibonacci />
          <PipValue />
        </div>
        <p className="vx-fineprint">Calculators are educational tools. Always confirm values with your broker before trading.</p>
      </main>
      <Footer />
    </div>
  );
}
