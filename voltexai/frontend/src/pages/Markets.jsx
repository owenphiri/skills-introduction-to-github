// src/pages/Markets.jsx — live markets board with candlestick chart
import { useEffect, useRef, useState } from "react";
import { NavBar } from "../components/NavBar";
import { CandleChart } from "../components/Chart";
import { marketsService } from "../services/markets";

const CLASSES = [
  { id: "all", label: "All" },
  { id: "forex", label: "Forex" },
  { id: "metals", label: "Metals" },
  { id: "energy", label: "Energy" },
  { id: "indices", label: "Indices" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
];
const TFS = ["M5", "M15", "M30", "H1", "H4", "D1"];

const SOURCE_LABELS = {
  "oanda-stream": "OANDA LIVE", twelvedata: "LIVE", finnhub: "LIVE",
  binance: "LIVE", synthetic: "SIM",
};
function SourceBadge({ source }) {
  const live = source && source !== "synthetic";
  return (
    <span className={`vx-source ${live ? "live" : "sim"}`} title={`Data source: ${source}`}>
      {live ? "● " : "○ "}{SOURCE_LABELS[source] || source}
    </span>
  );
}

export default function Markets() {
  const [assetClass, setAssetClass] = useState("all");
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("M15");
  const [candles, setCandles] = useState([]);
  const wsRef = useRef(null);

  // quotes for the table (refresh class on change, then keep live via WS)
  useEffect(() => {
    let alive = true;
    marketsService.quotes({ assetClass })
      .then((d) => alive && setQuotes(d.quotes)).catch(() => {});
    const syms = null; // stream the default broad set
    wsRef.current?.close?.();
    wsRef.current = marketsService.openStream(syms, (qs) => {
      if (!alive) return;
      setQuotes((prev) => {
        const map = Object.fromEntries(qs.map((q) => [q.symbol, q]));
        return prev.map((p) => map[p.symbol] || p);
      });
    });
    return () => { alive = false; wsRef.current?.close?.(); };
  }, [assetClass]);

  // candles for selected instrument
  useEffect(() => {
    let alive = true;
    const load = () => marketsService.candles(selected, timeframe, 120)
      .then((d) => alive && setCandles(d.candles)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [selected, timeframe]);

  const sel = quotes.find((q) => q.symbol === selected);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Live Markets</h1>
          <p className="vx-muted">Real-time prices across every asset class. Click a row to chart it.</p>
        </div>

        <div className="vx-chart-card">
          <div className="vx-chart-head">
            <div>
              <h2>{selected}{sel ? ` · ${sel.price}` : ""}</h2>
              {sel && (
                <span className={sel.change_pct >= 0 ? "vx-up" : "vx-down"}>
                  {sel.change_pct >= 0 ? "+" : ""}{sel.change} ({sel.change_pct}%)
                </span>
              )}
              {sel && <SourceBadge source={sel.source} />}
            </div>
            <div className="vx-tf-toggle">
              {TFS.map((tf) => (
                <button key={tf} className={tf === timeframe ? "active" : ""}
                  onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
          </div>
          <CandleChart candles={candles} />
        </div>

        <div className="vx-class-tabs">
          {CLASSES.map((c) => (
            <button key={c.id} className={c.id === assetClass ? "active" : ""}
              onClick={() => setAssetClass(c.id)}>{c.label}</button>
          ))}
        </div>

        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead>
              <tr>
                <th>Symbol</th><th>Name</th><th className="vx-r">Price</th>
                <th className="vx-r">Change</th><th className="vx-r">24h %</th>
                <th className="vx-r">Day range</th><th className="vx-r">Spread</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.symbol} className={q.symbol === selected ? "active" : ""}
                  onClick={() => setSelected(q.symbol)}>
                  <td><b>{q.symbol}</b></td>
                  <td className="vx-muted">{q.display}</td>
                  <td className="vx-r vx-mono">{q.price}</td>
                  <td className={`vx-r vx-mono ${q.change_pct >= 0 ? "vx-up" : "vx-down"}`}>
                    {q.change_pct >= 0 ? "+" : ""}{q.change}
                  </td>
                  <td className={`vx-r vx-mono ${q.change_pct >= 0 ? "vx-up" : "vx-down"}`}>
                    {q.change_pct >= 0 ? "+" : ""}{q.change_pct}%
                  </td>
                  <td className="vx-r vx-mono vx-muted">{q.day_low} – {q.day_high}</td>
                  <td className="vx-r vx-mono vx-muted">{q.spread}</td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr><td colSpan="7" className="vx-muted vx-center">Loading market data…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="vx-fineprint">
          Prices are indicative. When a live feed is configured, crypto is sourced live;
          otherwise a high-fidelity simulated feed keeps the platform fully functional.
        </p>
      </main>
    </div>
  );
}
