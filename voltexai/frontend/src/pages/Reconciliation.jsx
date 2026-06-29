// src/pages/Reconciliation.jsx — cross-venue account reconciliation statement
import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { tradeService } from "../services/trade";

const DISCREPANCY_LABELS = {
  venue_unreachable: "Venue unreachable",
  off_route_position: "Position off its routing venue",
  symbol_split_across_venues: "Symbol split across venues",
};

export default function Reconciliation() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    tradeService.reconciliation()
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const c = data?.consolidated;

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Account Reconciliation</h1>
          <p className="vx-muted">
            One consolidated statement across every trading venue, with net exposure
            per symbol and automatic discrepancy checks.
          </p>
        </div>

        {loading && <p className="vx-muted">Reconciling venues…</p>}
        {err && <div className="vx-banner vx-banner--warn">{err}</div>}

        {data && (
          <>
            <div className={`vx-recon-status ${data.reconciled ? "ok" : "warn"}`}>
              {data.reconciled
                ? "✓ All venues reconciled — no discrepancies detected."
                : `⚠ ${data.discrepancies.length} discrepanc${data.discrepancies.length === 1 ? "y" : "ies"} flagged below.`}
              <span className="vx-recon-broker">broker: {data.broker}{data.is_live ? " · LIVE" : ""}</span>
            </div>

            {c && (
              <div className="vx-stat-row">
                <div className="vx-stat"><b>${c.equity.toLocaleString()}</b><span>Total equity</span></div>
                <div className="vx-stat"><b>${c.cash.toLocaleString()}</b><span>Total cash</span></div>
                <div className="vx-stat">
                  <b className={c.unrealized_pnl >= 0 ? "vx-up" : "vx-down"}>
                    {c.unrealized_pnl >= 0 ? "+" : ""}${c.unrealized_pnl.toLocaleString()}
                  </b><span>Unrealized P&L</span>
                </div>
                <div className="vx-stat">
                  <b className={c.realized_pnl >= 0 ? "vx-up" : "vx-down"}>
                    {c.realized_pnl >= 0 ? "+" : ""}${c.realized_pnl.toLocaleString()}
                  </b><span>Realized P&L</span>
                </div>
                <div className="vx-stat"><b>{c.positions}</b><span>Open positions</span></div>
              </div>
            )}

            {data.discrepancies.length > 0 && (
              <div className="vx-recon-flags">
                {data.discrepancies.map((d, i) => (
                  <div key={i} className="vx-flag">
                    <b>{DISCREPANCY_LABELS[d.type] || d.type}</b>
                    <span>{[d.symbol, d.venue && `@${d.venue}`, d.expected_venue && `→ expected ${d.expected_venue}`,
                      d.detail, d.venues && d.venues.join(" + ")].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="vx-section-title vx-left">Venues</h2>
            <div className="vx-card-grid">
              {data.venues.map((v) => (
                <div key={v.venue} className="vx-dir-card">
                  <div className="vx-dir-head">
                    <div>
                      <h3>{v.venue}{v.is_live && <span className="vx-venue">live</span>}</h3>
                      <span className="vx-muted">{v.status}</span>
                    </div>
                    {v.account && <span className="vx-rating">${v.account.equity.toLocaleString()}</span>}
                  </div>
                  {v.error && <p className="vx-down">{v.error}</p>}
                  {v.account && (
                    <div className="vx-dir-stats">
                      <div><span>Cash</span><b>${v.account.cash.toLocaleString()}</b></div>
                      <div><span>Unrealized</span><b className={v.account.unrealized_pnl >= 0 ? "vx-up" : "vx-down"}>${v.account.unrealized_pnl.toLocaleString()}</b></div>
                      <div><span>Positions</span><b>{v.positions?.length ?? 0}</b></div>
                      <div><span>Return</span><b className={v.account.total_return_pct >= 0 ? "vx-up" : "vx-down"}>{v.account.total_return_pct}%</b></div>
                    </div>
                  )}
                </div>
              ))}
              {data.venues.length === 0 && <p className="vx-muted">No active venues with holdings.</p>}
            </div>

            {data.exposure_by_symbol.length > 0 && (
              <>
                <h2 className="vx-section-title vx-left">Net exposure by symbol</h2>
                <div className="vx-table-wrap">
                  <table className="vx-table">
                    <thead><tr>
                      <th>Symbol</th><th className="vx-r">Net qty</th>
                      <th className="vx-r">Unrealized P&L</th><th>Venue(s)</th>
                    </tr></thead>
                    <tbody>
                      {data.exposure_by_symbol.map((e) => (
                        <tr key={e.symbol}>
                          <td><b>{e.symbol}</b></td>
                          <td className={`vx-r vx-mono ${e.net_qty >= 0 ? "vx-up" : "vx-down"}`}>{e.net_qty}</td>
                          <td className={`vx-r vx-mono ${e.unrealized_pnl >= 0 ? "vx-up" : "vx-down"}`}>
                            {e.unrealized_pnl >= 0 ? "+" : ""}{e.unrealized_pnl}
                          </td>
                          <td>{[...new Set(e.venues)].map((vn) => <span key={vn} className="vx-venue">{vn}</span>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
