// src/components/ResultsMarquee.jsx — horizontal ticker of VERIFIED client wins
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { resultsService } from "../services/results";

function gain(p) {
  if (p.pnl_pct != null) return `+${p.pnl_pct}%`;
  if (p.pnl_amount != null) return `+${p.pnl_amount} ${p.currency || ""}`.trim();
  return "win";
}

export function ResultsMarquee() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    resultsService.feed({ verified: true, limit: 24 })
      .then((d) => setItems((d.posts || []).filter((p) => p.verified)))
      .catch(() => {});
  }, []);

  if (!items.length) return null;
  const loop = [...items, ...items];   // duplicated for a seamless CSS loop

  return (
    <section className="vx-wins-ticker" aria-label="Verified client results">
      <span className="vx-wins-ticker-label">✓ Verified wins</span>
      <div className="vx-ticker vx-wins-ticker-strip">
        <div className="vx-ticker-track">
          {loop.map((p, i) => (
            <Link key={i} to="/dashboard" className="vx-ticker-item vx-wins-item">
              <span className="vx-flag">{p.flag}</span>
              <b>{p.author}</b>
              <span className="vx-wins-gain">{gain(p)}</span>
              {p.symbol && <span className="vx-wins-sym">{p.symbol}</span>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
