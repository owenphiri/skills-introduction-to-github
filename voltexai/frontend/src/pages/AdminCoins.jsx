// src/pages/AdminCoins.jsx — Voltex Coin admin console (admin only)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { coinService } from "../services/coin";

function fmt(n) { return (n ?? 0).toLocaleString(); }

export default function AdminCoins() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("goodwill");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadStats = () => coinService.adminStats().then(setStats).catch((e) => setErr(e.message));
  useEffect(() => { loadStats(); }, []);

  async function lookup(e) {
    e?.preventDefault(); setErr(""); setMsg("");
    try { setTarget(await coinService.adminUser(q)); }
    catch (e2) { setTarget(null); setErr(e2.message || "User not found"); }
  }

  async function adjust(sign) {
    setErr(""); setMsg("");
    const amt = sign * Math.abs(parseInt(amount, 10) || 0);
    if (!target || !amt) { setErr("Enter a user and a non-zero amount."); return; }
    try {
      const r = await coinService.adminAdjust(target.email, amt, reason);
      setMsg(`${amt > 0 ? "Granted" : "Deducted"} ${fmt(Math.abs(amt))} VXC · new balance ${fmt(r.balance)}`);
      setAmount("");
      await lookup(); await loadStats();
    } catch (e2) { setErr(e2.message || "Adjust failed"); }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Admin · Voltex Coin</span>
          <h1>🪙 Coin Console</h1>
          <p className="vx-muted">Ecosystem VXC supply, holders, and manual grants/deductions.</p>
        </div>
        {err && <div className="vx-error">{err}</div>}
        {msg && <div className="vx-coin-banner" style={{ marginBottom: "1rem" }}>{msg}</div>}

        {/* Stats */}
        {stats && (
          <div className="vx-kpi-grid" style={{ marginBottom: "1.5rem" }}>
            {[["Issued", `${fmt(stats.total_issued)} VXC`],
              ["Redeemed", `${fmt(stats.total_redeemed)} VXC`],
              ["Circulating", `${fmt(stats.circulating)} VXC`],
              ["Holders", fmt(stats.holders)],
              ["USD liability", `$${fmt(stats.usd_liability)}`]].map(([k, v]) => (
              <div key={k} className="vx-kpi-card">
                <div className="vx-kpi-top"><span className="vx-kpi-label">{k}</span></div>
                <b className="vx-kpi-value">{v}</b>
              </div>
            ))}
          </div>
        )}

        {/* Adjust */}
        <div className="vx-panel" style={{ padding: "1.3rem 1.5rem", marginBottom: "1.5rem" }}>
          <h2 className="vx-section-title vx-left" style={{ marginTop: 0 }}>Grant / deduct</h2>
          <form onSubmit={lookup} className="vx-coin-admin-row">
            <input placeholder="user email or id" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="vx-btn-secondary vx-btn-sm" type="submit">Look up</button>
          </form>
          {target && (
            <>
              <p className="vx-muted" style={{ marginTop: 12 }}>
                <b>{target.name}</b> · {target.email} — balance <b>{fmt(target.balance)} VXC</b> (${target.usd_value})
              </p>
              <div className="vx-coin-admin-row">
                <input type="number" placeholder="amount" value={amount}
                  onChange={(e) => setAmount(e.target.value)} />
                <input placeholder="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="vx-btn-primary vx-btn-sm" onClick={() => adjust(+1)}>+ Grant</button>
                <button className="vx-btn-danger vx-btn-sm" onClick={() => adjust(-1)}>− Deduct</button>
              </div>
              {target.history?.length > 0 && (
                <div className="vx-table-wrap" style={{ marginTop: 14 }}>
                  <table className="vx-table">
                    <thead><tr><th>Reason</th><th>Amount</th><th>Balance</th></tr></thead>
                    <tbody>
                      {target.history.slice(0, 12).map((h, i) => (
                        <tr key={i}>
                          <td>{h.reason.replace(/_/g, " ")}</td>
                          <td className={h.amount >= 0 ? "vx-up" : "vx-down"}>
                            {h.amount >= 0 ? "+" : ""}{fmt(h.amount)}</td>
                          <td>{fmt(h.balance_after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Top holders */}
        {stats?.top_holders?.length > 0 && (
          <>
            <h2 className="vx-section-title vx-left">Top holders</h2>
            <div className="vx-table-wrap">
              <table className="vx-table">
                <thead><tr><th>User</th><th>Email</th><th>Balance</th></tr></thead>
                <tbody>
                  {stats.top_holders.map((h) => (
                    <tr key={h.user_id}>
                      <td>{h.name}</td><td>{h.email}</td><td>{fmt(h.balance)} VXC</td>
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
