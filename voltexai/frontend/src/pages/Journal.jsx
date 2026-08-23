// src/pages/Journal.jsx — Voltex Trade Journal (advanced dashboard)
import { useEffect, useMemo, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { journalService } from "../services/journal";

function EquityCurve({ points }) {
  if (!points.length) return <p className="vx-muted">Log trades to see your equity curve.</p>;
  const w = 640, h = 180, pad = 8;
  const eq = points.map((p) => p.equity);
  const lo = Math.min(0, ...eq), hi = Math.max(0, ...eq);
  const span = hi - lo || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const pts = points.map((p, i) => `${(pad + i * step).toFixed(1)},${y(p.equity).toFixed(1)}`);
  const last = eq[eq.length - 1];
  const color = last >= 0 ? "var(--vx-success)" : "var(--vx-danger)";
  return (
    <svg className="vx-equity" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1={pad} y1={y(0)} x2={w - pad} y2={y(0)} stroke="var(--vx-border)" strokeDasharray="4 4" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Heatmap({ heatmap }) {
  const { days, max_gain, max_loss } = heatmap;
  const color = (d) => {
    if (!d.trades) return "var(--vx-bg-elev)";
    if (d.pnl >= 0) {
      const t = max_gain ? d.pnl / max_gain : 0;
      return `color-mix(in srgb, var(--vx-success) ${20 + t * 70}%, var(--vx-bg-elev))`;
    }
    const t = max_loss ? d.pnl / max_loss : 0;
    return `color-mix(in srgb, var(--vx-danger) ${20 + t * 70}%, var(--vx-bg-elev))`;
  };
  return (
    <div className="vx-heatmap-wrap">
      <div className="vx-heatmap">
        {days.map((d) => (
          <div key={d.date} className="vx-heat-cell" style={{ background: color(d) }}
            title={`${d.date}: ${d.pnl >= 0 ? "+" : ""}${d.pnl} (${d.trades} trade${d.trades === 1 ? "" : "s"})`} />
        ))}
      </div>
      <div className="vx-heat-legend">
        <span className="vx-muted">Loss</span>
        <span className="vx-heat-swatch" style={{ background: "var(--vx-danger)" }} />
        <span className="vx-heat-swatch" style={{ background: "var(--vx-bg-elev)" }} />
        <span className="vx-heat-swatch" style={{ background: "var(--vx-success)" }} />
        <span className="vx-muted">Gain</span>
      </div>
    </div>
  );
}

const EMPTY = { symbol: "", side: "buy", entry: "", exit: "", size: "1", pnl: "", rr: "", setup: "", trade_date: "", notes: "" };

export default function Journal() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => journalService.load().then(setData).catch(() => setErr("Could not load journal."));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await journalService.add({
        symbol: form.symbol, side: form.side,
        entry: parseFloat(form.entry), exit: form.exit ? parseFloat(form.exit) : null,
        size: parseFloat(form.size || "1"), pnl: parseFloat(form.pnl || "0"),
        rr: form.rr ? parseFloat(form.rr) : null, setup: form.setup || null,
        trade_date: form.trade_date || null, notes: form.notes || null,
      });
      setForm(EMPTY); load();
    } catch { setErr("Could not save — check the numbers and try again."); }
    finally { setBusy(false); }
  };

  const del = async (id) => { await journalService.remove(id).catch(() => {}); load(); };

  const s = data?.stats;
  const kpis = useMemo(() => s ? [
    { label: "Net P&L", value: `${s.net_pnl >= 0 ? "+" : ""}${s.net_pnl}`, cls: s.net_pnl >= 0 ? "vx-up" : "vx-down", accent: s.net_pnl >= 0 ? "#45e0a0" : "#ff5560" },
    { label: "Win rate", value: `${s.win_rate}%`, accent: "#4d7cff" },
    { label: "Profit factor", value: s.profit_factor, accent: "#c2f53d" },
    { label: "Avg R", value: s.avg_rr, accent: "#a06bff" },
    { label: "Trades", value: s.count, accent: "#ffb547" },
    { label: "Expectancy", value: s.expectancy, accent: "#4dd0e1" },
  ] : [], [s]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Track · Review · Improve</span>
          <h1>📓 Voltex Trade Journal</h1>
          <p className="vx-muted">Your edge, measured — KPIs, equity curve and a P&amp;L heat-map calendar.</p>
        </div>
        {err && <p className="vx-down">{err}</p>}
        {!data && !err && <p className="vx-muted">Loading your journal…</p>}

        {data && (
          <>
            <div className="vx-kpi-grid">
              {kpis.map((k) => (
                <div key={k.label} className="vx-kpi-card" style={{ "--kpi-accent": k.accent }}>
                  <div className="vx-kpi-top"><span className="vx-kpi-label">{k.label}</span></div>
                  <div className={`vx-kpi-value ${k.cls || ""}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel">
                <h3>Equity curve</h3>
                <EquityCurve points={data.equity} />
              </div>
              <div className="vx-panel">
                <h3>Add a trade</h3>
                <form className="vx-journal-form" onSubmit={submit}>
                  <div className="vx-jf-row">
                    <input required placeholder="Symbol (EURUSD)" value={form.symbol}
                      onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
                    <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
                      <option value="buy">Buy</option><option value="sell">Sell</option>
                    </select>
                  </div>
                  <div className="vx-jf-row">
                    <input required type="number" step="any" placeholder="Entry" value={form.entry}
                      onChange={(e) => setForm({ ...form, entry: e.target.value })} />
                    <input type="number" step="any" placeholder="Exit" value={form.exit}
                      onChange={(e) => setForm({ ...form, exit: e.target.value })} />
                  </div>
                  <div className="vx-jf-row">
                    <input required type="number" step="any" placeholder="P&L" value={form.pnl}
                      onChange={(e) => setForm({ ...form, pnl: e.target.value })} />
                    <input type="number" step="any" placeholder="R multiple" value={form.rr}
                      onChange={(e) => setForm({ ...form, rr: e.target.value })} />
                  </div>
                  <div className="vx-jf-row">
                    <input placeholder="Setup (SMC, Breakout…)" value={form.setup}
                      onChange={(e) => setForm({ ...form, setup: e.target.value })} />
                    <input type="date" value={form.trade_date}
                      onChange={(e) => setForm({ ...form, trade_date: e.target.value })} />
                  </div>
                  <button className="vx-btn-primary" disabled={busy}>{busy ? "Saving…" : "Log trade"}</button>
                </form>
              </div>
            </div>

            <div className="vx-panel">
              <h3>P&amp;L calendar (last 26 weeks)</h3>
              <Heatmap heatmap={data.heatmap} />
            </div>

            <div className="vx-journal-grid">
              <div className="vx-panel">
                <h3>By setup</h3>
                {data.by_setup.length ? data.by_setup.map((b) => (
                  <div key={b.label} className="vx-break-row">
                    <span>{b.label}</span>
                    <span className={b.pnl >= 0 ? "vx-up" : "vx-down"}>{b.pnl >= 0 ? "+" : ""}{b.pnl}</span>
                    <small className="vx-muted">{b.count} · {b.win_rate}% W</small>
                  </div>
                )) : <p className="vx-muted">No trades yet.</p>}
              </div>
              <div className="vx-panel">
                <h3>By symbol</h3>
                {data.by_symbol.length ? data.by_symbol.map((b) => (
                  <div key={b.label} className="vx-break-row">
                    <span>{b.label}</span>
                    <span className={b.pnl >= 0 ? "vx-up" : "vx-down"}>{b.pnl >= 0 ? "+" : ""}{b.pnl}</span>
                    <small className="vx-muted">{b.count} · {b.win_rate}% W</small>
                  </div>
                )) : <p className="vx-muted">No trades yet.</p>}
              </div>
            </div>

            <h2 className="vx-section-title">Recent trades</h2>
            <div className="vx-trade-table">
              {data.trades.length === 0 && <p className="vx-muted">Your logged trades will appear here.</p>}
              {data.trades.map((t) => (
                <div key={t.id} className="vx-trade-row">
                  <span className={`vx-side vx-side--${t.side}`}>{t.side.toUpperCase()}</span>
                  <b>{t.symbol}</b>
                  <span className="vx-muted">{t.trade_date}</span>
                  <span className="vx-muted">{t.setup || "—"}</span>
                  <span className={t.pnl >= 0 ? "vx-up" : "vx-down"}>{t.pnl >= 0 ? "+" : ""}{t.pnl}</span>
                  <span className="vx-muted">{t.rr != null ? `${t.rr}R` : ""}</span>
                  <button className="vx-trade-del" onClick={() => del(t.id)} title="Delete">×</button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
