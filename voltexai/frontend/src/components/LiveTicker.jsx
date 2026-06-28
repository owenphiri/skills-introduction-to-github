// src/components/LiveTicker.jsx — scrolling live price strip (WebSocket-backed)
import { useEffect, useRef, useState } from "react";
import { marketsService } from "../services/markets";

const TICKER_SYMBOLS = [
  "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "ETHUSD",
  "NAS100", "US30", "SPX500", "WTIUSD", "USDZAR", "SOLUSD",
];

export function LiveTicker() {
  const [quotes, setQuotes] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    let alive = true;
    // seed immediately via REST, then keep fresh via WS
    marketsService.quotes({ symbols: TICKER_SYMBOLS })
      .then((d) => alive && setQuotes(d.quotes))
      .catch(() => {});
    try {
      wsRef.current = marketsService.openStream(TICKER_SYMBOLS, (q) => alive && setQuotes(q));
    } catch {
      /* ws unavailable — REST seed still shows */
    }
    return () => { alive = false; wsRef.current?.close?.(); };
  }, []);

  if (!quotes.length) return <div className="vx-ticker vx-ticker--empty" />;
  const row = [...quotes, ...quotes]; // duplicate for seamless marquee

  return (
    <div className="vx-ticker">
      <div className="vx-ticker-track">
        {row.map((q, i) => (
          <span key={i} className="vx-ticker-item">
            <b>{q.symbol}</b>
            <span>{q.price}</span>
            <span className={q.change_pct >= 0 ? "vx-up" : "vx-down"}>
              {q.change_pct >= 0 ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
