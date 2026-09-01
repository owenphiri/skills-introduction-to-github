// src/pages/AdminRealEstate.jsx — Real Estate waitlist / demand book (admin only)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { realEstateService } from "../services/ecosystem";
import { fmtMoney as money } from "../components/InvestModal";

function ago(iso) {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "—";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}

export default function AdminRealEstate() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    realEstateService.adminWaitlist().then(setD).catch((e) => setErr(e.message));
  }, []);

  const maxDemand = Math.max(1, ...(d?.properties || []).map((p) => p.total_usd));

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Admin · Real Estate</span>
          <h1>🏠 Waitlist &amp; Demand</h1>
          <p className="vx-muted">Reserved interest across the Coming-Soon property vertical — your pre-MOU demand book.</p>
        </div>
        {err && <div className="vx-error">{err}</div>}

        {d && (
          <>
            <div className="vx-kpi-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="vx-kpi-card"><div className="vx-kpi-top"><span className="vx-kpi-label">Total signups</span></div><b className="vx-kpi-value">{d.total_signups.toLocaleString()}</b></div>
              <div className="vx-kpi-card"><div className="vx-kpi-top"><span className="vx-kpi-label">Reserved demand</span></div><b className="vx-kpi-value">{money(d.total_demand_usd)}</b></div>
              <div className="vx-kpi-card"><div className="vx-kpi-top"><span className="vx-kpi-label">Live deals</span></div><b className="vx-kpi-value">{d.properties.length}</b></div>
            </div>

            <h2 className="vx-section-title vx-left">Demand by property</h2>
            <div className="vx-re-demand">
              {d.properties.map((p) => (
                <div key={p.id} className="vx-re-demand-row">
                  <div className="vx-re-demand-name">{p.flag} <b>{p.name}</b> <span className="vx-muted">· {p.city}, {p.country}</span></div>
                  <div className="vx-re-demand-bar"><span style={{ width: `${(p.total_usd / maxDemand) * 100}%`, background: p.accent }} /></div>
                  <div className="vx-re-demand-meta"><b>{money(p.total_usd)}</b><span className="vx-muted">{p.count} signup{p.count === 1 ? "" : "s"}</span></div>
                </div>
              ))}
            </div>

            <h2 className="vx-section-title vx-left" style={{ marginTop: 32 }}>Recent reservations</h2>
            <div className="vx-table-wrap">
              <table className="vx-table">
                <thead><tr><th>Property</th><th>Investor</th><th>Amount</th><th>Rail</th><th>Country</th><th>When</th></tr></thead>
                <tbody>
                  {d.recent.length === 0 && <tr><td colSpan="6" className="vx-muted">No reservations yet.</td></tr>}
                  {d.recent.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>{money(r.amount_usd)}</td>
                      <td>{r.provider || "—"}</td>
                      <td>{r.country || "—"}</td>
                      <td>{ago(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
