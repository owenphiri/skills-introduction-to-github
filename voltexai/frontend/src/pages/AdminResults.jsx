// src/pages/AdminResults.jsx — moderate the global Results wall (admin only)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { adminService } from "../services/hub";

export default function AdminResults() {
  const [rows, setRows] = useState([]);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);

  const load = () => {
    setErr("");
    adminService.results(onlyUnverified)
      .then((d) => setRows(d.results || []))
      .catch((e) => setErr(e.status === 401 || e.status === 403 ? "Admin access required." : e.message));
  };
  useEffect(load, [onlyUnverified]);

  const toggle = (r) => {
    setBusy(r.id);
    adminService.verifyResult(r.id, !r.verified)
      .then((res) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, verified: res.verified } : x))))
      .catch((e) => setErr(e.message)).finally(() => setBusy(null));
  };

  const remove = (r) => {
    if (!window.confirm(`Delete ${r.author}'s result? This cannot be undone.`)) return;
    setBusy(r.id);
    adminService.deleteResult(r.id)
      .then(() => setRows((rs) => rs.filter((x) => x.id !== r.id)))
      .catch((e) => setErr(e.message)).finally(() => setBusy(null));
  };

  const pending = rows.filter((r) => !r.verified).length;

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛡️ Results Moderation</h1>
          <p className="vx-muted">
            Verify genuine client wins (adds the ✓ badge and floats them to the top of the wall)
            or remove spam. {pending} unverified.
          </p>
        </div>

        <label className="vx-switch" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} />
          Show only unverified
        </label>
        {err && <p className="vx-results-msg" style={{ color: "var(--vx-danger)" }}>{err}</p>}

        <div className="vx-admin-results">
          {rows.map((r) => (
            <div key={r.id} className={`vx-admin-result ${r.verified ? "is-verified" : ""}`}>
              <div className="vx-admin-result-main">
                <div className="vx-admin-result-top">
                  <span><span className="vx-flag">{r.flag}</span> <b>{r.author}</b>
                    <small className="vx-muted"> · {r.country} · {new Date(r.created_at).toLocaleString()}</small></span>
                  {r.verified
                    ? <span className="vx-result-verified">✓ Verified</span>
                    : <span className="vx-admin-pending">Pending</span>}
                </div>
                <p className="vx-admin-result-body">{r.body}</p>
                <div className="vx-result-meta">
                  {r.symbol && <span className="vx-chip">{r.symbol}</span>}
                  {r.market && <span className="vx-chip">{r.market}</span>}
                  {r.timeframe && <span className="vx-chip">{r.timeframe}</span>}
                  {r.pnl_pct != null && <span className="vx-result-pnl">+{r.pnl_pct}%</span>}
                  {r.image_url && <a className="vx-chip" href={r.image_url} target="_blank" rel="noopener noreferrer">screenshot ↗</a>}
                  <span className="vx-muted" style={{ marginLeft: "auto" }}>♥ {r.likes}</span>
                </div>
              </div>
              <div className="vx-admin-result-actions">
                <button className={`vx-btn-sm ${r.verified ? "vx-btn-secondary" : "vx-btn-primary"}`}
                  disabled={busy === r.id} onClick={() => toggle(r)}>
                  {r.verified ? "Unverify" : "✓ Verify"}
                </button>
                <button className="vx-btn-sm vx-btn-danger" disabled={busy === r.id} onClick={() => remove(r)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && !err && <p className="vx-muted">No results to moderate.</p>}
        </div>
      </main>
    </div>
  );
}
