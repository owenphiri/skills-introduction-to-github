// src/pages/AdminSignals.jsx — admin desk: create signals + manage lifecycle
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { proSignalsService } from "../services/hub";
import { useAuth } from "../contexts/AuthContext";

const FLAGS = ["htf", "liquidity", "ob", "fvg", "trend", "momentum"];
const EMPTY = { symbol: "", direction: "buy", timeframe: "15", entry: "", sl: "",
                strategy: "Voltex AI", session: "London" };
const EVENTS = ["filled", "tp1", "tp2", "tp3", "tp4", "be", "closed", "cancelled"];

export default function AdminSignals() {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const [perf, setPerf] = useState(null);
  const [rl, setRl] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [flags, setFlags] = useState(Object.fromEntries(FLAGS.map((f) => [f, true])));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    proSignalsService.feed(50).then(setFeed).catch(() => {});
    proSignalsService.performance().then(setPerf).catch(() => {});
    proSignalsService.rlModel().then(setRl).catch(() => {});
  };
  useEffect(() => { if (user?.role === "admin") load(); }, [user]);

  if (!user) return null;
  if (user.role !== "admin") {
    return (
      <div className="vx-page"><NavBar />
        <main className="vx-container"><div className="vx-page-head">
          <h1>🔒 Admin only</h1>
          <p className="vx-muted">This desk is for VoltexAI administrators.</p>
          <Link to="/pro-signals" className="vx-btn-primary vx-btn-sm">Go to Signals Pro</Link>
        </div></main><Footer />
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await proSignalsService.create({
        symbol: form.symbol, direction: form.direction, timeframe: form.timeframe,
        entry: parseFloat(form.entry), sl: parseFloat(form.sl),
        strategy: form.strategy, session: form.session, ...flags,
      });
      setMsg(r.published ? `Published ${r.grade} (${r.quality_score}/100)`
                         : `Not published: ${r.reason || "below min score"}`);
      setForm(EMPTY); load();
    } catch { setMsg("Create failed — check entry/SL (stop must be on the correct side)."); }
    finally { setBusy(false); }
  };

  const fire = async (uuid, event) => {
    const body = { event };
    if (event === "closed" || event === "cancelled") {
      const r = prompt("Result in R (e.g. 3 or -1):", event === "closed" ? "3" : "0");
      if (r !== null) body.result_r = parseFloat(r) || 0;
    }
    await proSignalsService.event(uuid, body).catch(() => {});
    load();
  };

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Admin Desk</span>
          <h1>🛠️ Signals Admin</h1>
          <p className="vx-muted">Publish manual signals and manage the live lifecycle.</p>
        </div>

        {perf && (
          <div className="vx-perf-strip">
            <div className="vx-perf"><b>{perf.win_rate}%</b><span>Win rate</span></div>
            <div className="vx-perf"><b>{perf.profit_factor}</b><span>Profit factor</span></div>
            <div className="vx-perf"><b className="vx-up">{perf.total_r >= 0 ? "+" : ""}{perf.total_r}R</b><span>Total R</span></div>
            <div className="vx-perf"><b>{perf.active}</b><span>Active</span></div>
            <div className="vx-perf"><b>{perf.total_signals}</b><span>Total</span></div>
            <div className="vx-perf"><b>{perf.best_pair || "—"}</b><span>Best pair</span></div>
          </div>
        )}

        {rl && (
          <div className="vx-panel vx-rl-panel">
            <div className="vx-rl-head">
              <h3>🧠 RL Model <span className={`vx-rl-status ${rl.status}`}>{rl.status}</span></h3>
              <span className="vx-muted">{rl.updates} updates · {rl.win_rate}% win · confidence {Math.round(rl.confidence * 100)}%</span>
            </div>
            <p className="vx-muted">Learned component importance (what actually predicts winners):</p>
            <div className="vx-rl-weights">
              {rl.importance.map((f) => (
                <div key={f.feature} className="vx-rl-weight">
                  <span>{f.feature.replace(/_/g, " ")}</span>
                  <div className="vx-rl-bar">
                    <div className={f.weight >= 0 ? "pos" : "neg"}
                      style={{ width: `${Math.min(100, Math.abs(f.weight) * 30)}%` }} />
                  </div>
                  <b className={f.weight >= 0 ? "vx-up" : "vx-down"}>{f.weight}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="vx-panel">
          <h3>Publish a signal</h3>
          <form className="vx-journal-form" onSubmit={submit}>
            <div className="vx-jf-row">
              <input required placeholder="Symbol (XAUUSD)" value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="buy">Buy</option><option value="sell">Sell</option>
              </select>
              <input placeholder="TF" value={form.timeframe} style={{ maxWidth: 90 }}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })} />
            </div>
            <div className="vx-jf-row">
              <input required type="number" step="any" placeholder="Entry" value={form.entry}
                onChange={(e) => setForm({ ...form, entry: e.target.value })} />
              <input required type="number" step="any" placeholder="Stop loss" value={form.sl}
                onChange={(e) => setForm({ ...form, sl: e.target.value })} />
            </div>
            <div className="vx-jf-row">
              <input placeholder="Strategy" value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })} />
              <input placeholder="Session" value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })} />
            </div>
            <div className="vx-flag-row">
              {FLAGS.map((f) => (
                <label key={f} className={`vx-flag ${flags[f] ? "on" : ""}`}>
                  <input type="checkbox" checked={flags[f]}
                    onChange={(e) => setFlags({ ...flags, [f]: e.target.checked })} />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
            <button className="vx-btn-primary" disabled={busy}>{busy ? "Publishing…" : "Publish signal"}</button>
            {msg && <p className="vx-muted">{msg}</p>}
          </form>
        </div>

        <h2 className="vx-section-title">Signals</h2>
        <div className="vx-admin-list">
          {feed?.signals.map((s) => (
            <div key={s.uuid} className="vx-admin-row">
              <div className="vx-admin-main">
                <b>{s.symbol} <span className={`vx-sig-dir ${s.direction}`}>{s.direction.toUpperCase()}</span></b>
                <span className="vx-muted">{s.grade} · {s.quality_score}/100 · RR 1:{s.risk_reward} · <b>{s.status}</b>
                  {s.result_r != null ? ` · ${s.result_r >= 0 ? "+" : ""}${s.result_r}R` : ""}</span>
              </div>
              <div className="vx-admin-actions">
                {EVENTS.map((ev) => (
                  <button key={ev} className="vx-mini-btn" onClick={() => fire(s.uuid, ev)}>{ev}</button>
                ))}
              </div>
            </div>
          ))}
          {feed && feed.signals.length === 0 && <p className="vx-muted">No signals yet.</p>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
