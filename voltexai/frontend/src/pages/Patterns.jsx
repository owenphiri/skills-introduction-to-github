// src/pages/Patterns.jsx — VoltexAI Chart Patterns (visual chart + TP/SL/BE plan)
import { useEffect, useMemo, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { patternsService } from "../services/hub";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD", "NAS100", "US30", "SPX500"];
const TFS = ["M5", "M15", "M30", "H1", "H4", "D1"];
const LINE_COLOR = { entry: "#4d7cff", sl: "#ff5560", tp: "#45e0a0", be: "#ffb547", neckline: "#a06bff" };

function Chart({ data }) {
  const { candles, lines, pattern, decimals } = data;
  const W = 900, H = 420, padL = 8, padR = 66, padT = 14, padB = 22;
  const geom = useMemo(() => {
    const prices = [];
    candles.forEach((c) => { prices.push(c.h, c.l); });
    lines.forEach((l) => prices.push(l.price));
    let lo = Math.min(...prices), hi = Math.max(...prices);
    const span = (hi - lo) || 1; lo -= span * 0.06; hi += span * 0.06;
    const n = candles.length;
    const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
    const y = (p) => padT + ((hi - p) / (hi - lo)) * (H - padT - padB);
    const cw = Math.max(1.5, ((W - padL - padR) / n) * 0.6);
    return { x, y, cw, n };
  }, [candles, lines]);

  const fmt = (p) => p.toFixed(decimals);
  return (
    <div className="vx-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="vx-chart" preserveAspectRatio="none">
        {/* candles */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? "var(--vx-success)" : "var(--vx-danger)";
          const bodyTop = geom.y(Math.max(c.o, c.c));
          const bodyH = Math.max(1, Math.abs(geom.y(c.o) - geom.y(c.c)));
          return (
            <g key={i} stroke={col} fill={col}>
              <line x1={geom.x(i)} y1={geom.y(c.h)} x2={geom.x(i)} y2={geom.y(c.l)} strokeWidth="1" />
              <rect x={geom.x(i) - geom.cw / 2} y={bodyTop} width={geom.cw} height={bodyH} />
            </g>
          );
        })}
        {/* level lines */}
        {lines.map((l, i) => (
          <g key={i}>
            <line x1={padL} y1={geom.y(l.price)} x2={W - padR} y2={geom.y(l.price)}
              stroke={LINE_COLOR[l.kind]} strokeWidth="1.3"
              strokeDasharray={l.kind === "neckline" ? "2 3" : "5 4"} opacity="0.9" />
            <rect x={W - padR + 2} y={geom.y(l.price) - 7} width={padR - 4} height={14} rx="3" fill={LINE_COLOR[l.kind]} />
            <text x={W - padR / 2} y={geom.y(l.price) + 3} textAnchor="middle" className="vx-chart-tag">{l.label}</text>
          </g>
        ))}
        {/* pattern points */}
        {pattern.points.map((pt, i) => (
          <g key={i}>
            <circle cx={geom.x(pt.i)} cy={geom.y(pt.price)} r="4" fill="#fff" stroke="#a06bff" strokeWidth="2" />
            <text x={geom.x(pt.i)} y={geom.y(pt.price) - 9} textAnchor="middle" className="vx-chart-pt">{pt.label}</text>
          </g>
        ))}
      </svg>
      <div className="vx-chart-legend">
        {["entry", "sl", "be", "tp", "neckline"].map((k) => (
          <span key={k}><i style={{ background: LINE_COLOR[k] }} />{k.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}

function ConfluenceBadge({ mtf }) {
  if (!mtf || !mtf.timeframes.length) return null;
  const cls = mtf.label.includes("Bullish") ? "bull" : mtf.label.includes("Bearish") ? "bear" : "mixed";
  const pct = Math.min(100, Math.abs(mtf.score));
  return (
    <div className={`vx-mtf ${cls}`}>
      <div className="vx-mtf-main">
        <span className="vx-eyebrow">Multi-timeframe confluence</span>
        <h3>{mtf.label} <small>{mtf.agreement}% agree</small></h3>
        <div className="vx-mtf-bar"><div className={`vx-mtf-fill ${cls}`} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="vx-mtf-tfs">
        {mtf.timeframes.map((t) => (
          <div key={t.tf} className={`vx-mtf-chip ${t.direction === "buy" ? "up" : "down"}`}>
            <b>{t.tf}</b>
            <span>{t.direction === "buy" ? "▲" : "▼"} {t.pattern}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Patterns() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [tf, setTf] = useState("M15");
  const [d, setD] = useState(null);
  const [mtf, setMtf] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    patternsService.detect(symbol, tf).then((r) => { if (alive) setD(r); }).catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol, tf]);

  useEffect(() => {
    let alive = true;
    setMtf(null);
    patternsService.confluence(symbol).then((r) => { if (alive) setMtf(r); }).catch(() => {});
    return () => { alive = false; };
  }, [symbol]);

  const p = d?.pattern, pl = d?.plan;
  const fmt = (v) => (d ? Number(v).toFixed(d.decimals) : v);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Voltex Vision</span>
          <h1>📐 Chart Patterns</h1>
          <p className="vx-muted">
            Automatic pattern detection on the live chart — with the entry, stop, take-profits
            and break-even drawn for you. Trade the plan, not the emotion.
          </p>
        </div>

        <div className="vx-pat-controls">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="vx-tf-tabs">
            {TFS.map((t) => (
              <button key={t} className={t === tf ? "active" : ""} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>

        <ConfluenceBadge mtf={mtf} />

        {!d && <p className="vx-muted">Reading the chart…</p>}
        {d && (
          <>
            <div className={`vx-pat-banner ${p.type}`}>
              <div>
                <span className="vx-eyebrow">{d.symbol} · {d.timeframe} · {d.trend === "up" ? "▲ uptrend" : "▼ downtrend"}</span>
                <h2>{p.name} <span className={`vx-sig-dir ${pl.direction}`}>{pl.direction.toUpperCase()}</span></h2>
                <p className="vx-muted">{p.description}</p>
              </div>
              <div className="vx-pat-conf">
                <b>{p.confidence}%</b><span>confidence</span>
              </div>
            </div>

            <Chart data={d} />

            <div className="vx-pat-plan">
              {[["Entry", pl.entry, "entry"], ["Stop Loss", pl.sl, "sl"], ["Break-even", pl.be, "be"],
                ["TP1", pl.tp1, "tp"], ["TP2", pl.tp2, "tp"], ["TP3", pl.tp3, "tp"]].map(([label, val, kind]) => (
                <div key={label} className="vx-pat-lvl" style={{ "--lc": LINE_COLOR[kind] }}>
                  <span>{label}</span><b>{fmt(val)}</b>
                </div>
              ))}
              <div className="vx-pat-lvl rr"><span>Reward:Risk</span><b>1:{pl.rr}</b></div>
            </div>

            <div className="vx-panel">
              <h3>Management</h3>
              <p className="vx-muted">{pl.management}</p>
              <p className="vx-muted">Current price <b>{fmt(d.current_price)}</b> · Support <b>{fmt(d.support)}</b> · Resistance <b>{fmt(d.resistance)}</b></p>
            </div>
          </>
        )}
        <p className="vx-fineprint">
          {loading ? "Updating…" : ""} Pattern detection is educational analysis, not financial advice.
          Confirm on your own chart and manage risk.
        </p>
      </main>
      <Footer />
    </div>
  );
}
