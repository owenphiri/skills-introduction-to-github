// src/pages/AUM.jsx — Assets Under Management + investor pitch deck
import { useEffect, useMemo, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Sparkline } from "../components/Chart";
import { fundService } from "../services/directory";

function EquityCurve({ points }) {
  if (!points?.length) return null;
  const w = 760, h = 220, pad = 10;
  const navs = points.map((p) => p.nav);
  const min = Math.min(...navs), max = Math.max(...navs);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const line = points.map((p, i) =>
    `${pad + i * step},${pad + (h - pad * 2) - ((p.nav - min) / span) * (h - pad * 2)}`
  ).join(" ");
  const area = `${pad},${h - pad} ${line} ${pad + (points.length - 1) * step},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="vx-equity" preserveAspectRatio="none">
      <polygon points={area} fill="var(--vx-accent-soft)" />
      <polyline points={line} fill="none" stroke="var(--vx-accent)" strokeWidth="2.5" />
    </svg>
  );
}

export default function AUM() {
  const [summary, setSummary] = useState(null);
  const [perf, setPerf] = useState(null);
  const [pitch, setPitch] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", amount_usd: 5000, tier: "starter", country: "" });
  const [sent, setSent] = useState("");

  useEffect(() => {
    fundService.summary().then(setSummary).catch(() => {});
    fundService.performance().then(setPerf).catch(() => {});
    fundService.pitch().then((d) => setPitch(d.slides)).catch(() => {});
  }, []);

  const o = summary?.overview;
  const maxAlloc = useMemo(
    () => Math.max(...(summary?.allocation || [{ weight_pct: 1 }]).map((a) => a.weight_pct)),
    [summary]
  );

  async function submit(e) {
    e.preventDefault();
    setSent("sending");
    try {
      const r = await fundService.enquire({ ...form, amount_usd: Number(form.amount_usd) });
      setSent(r.message || "Thanks — our desk will be in touch.");
    } catch (err) {
      setSent(err.message || "Something went wrong.");
    }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <section className="vx-aum-hero">
          <span className="vx-eyebrow">VoltexAI Managed Alpha</span>
          <h1>Put your capital to work — <span className="vx-grad">hands-off.</span></h1>
          <p className="vx-muted vx-aum-sub">
            Don't have time to trade? Allocate to the VoltexAI managed program. Your funds stay
            in a segregated account in your name; our desk trades it with the same AI-assisted
            methodology that powers the terminal.
          </p>
        </section>

        {summary && (
          <div className="vx-stat-row">
            <div className="vx-stat"><b>${(o.aum_usd / 1e6).toFixed(2)}M</b><span>Assets under management</span></div>
            <div className="vx-stat"><b>+{summary.cumulative_return_pct}%</b><span>Cumulative net (illustrative)</span></div>
            <div className="vx-stat"><b>{o.investors}</b><span>Investors</span></div>
            <div className="vx-stat"><b>{o.countries}</b><span>Countries</span></div>
            <div className="vx-stat"><b>{summary.positive_months}/{summary.total_months}</b><span>Positive months</span></div>
          </div>
        )}

        {perf && (
          <div className="vx-chart-card">
            <div className="vx-chart-head">
              <h2>Performance (illustrative track record)</h2>
              <span className="vx-muted">Net NAV growth, start = 100</span>
            </div>
            <EquityCurve points={perf.equity_curve} />
          </div>
        )}

        {summary && (
          <div className="vx-aum-grid">
            <div className="vx-aum-block">
              <h3>Strategy & terms</h3>
              <ul className="vx-deflist">
                <li><span>Strategy</span><b>{o.strategy}</b></li>
                <li><span>Target return</span><b>{o.target_net_return_annual_pct}% / yr</b></li>
                <li><span>Target max drawdown</span><b>{o.target_max_drawdown_pct}%</b></li>
                <li><span>Fees</span><b>{o.management_fee_pct}% mgmt + {o.performance_fee_pct}% perf (HWM)</b></li>
                <li><span>Minimum</span><b>${o.min_investment_usd.toLocaleString()} / K{o.min_investment_zmw.toLocaleString()}</b></li>
                <li><span>Redemption</span><b>{o.redemption}</b></li>
                <li><span>Custody</span><b>{o.custody}</b></li>
              </ul>
            </div>
            <div className="vx-aum-block">
              <h3>Allocation</h3>
              {summary.allocation.map((a) => (
                <div key={a.bucket} className="vx-alloc-row">
                  <span>{a.bucket}</span>
                  <div className="vx-alloc-bar">
                    <div style={{ width: `${(a.weight_pct / maxAlloc) * 100}%` }} />
                  </div>
                  <b>{a.weight_pct}%</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <>
            <h2 className="vx-section-title">Mandates</h2>
            <div className="vx-card-grid">
              {summary.tiers.map((t) => (
                <div key={t.id} className="vx-tier-card">
                  <h3>{t.name}</h3>
                  <div className="vx-tier-min">${t.min_usd.toLocaleString()}<span>minimum</span></div>
                  <p className="vx-tier-target">{t.target_return}</p>
                  <p className="vx-muted">Profit split {t.split}</p>
                  <ul className="vx-plan-features">
                    {t.perks.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                  <button className="vx-btn-primary vx-btn-sm"
                    onClick={() => setForm((f) => ({ ...f, tier: t.id, amount_usd: t.min_usd }))}>
                    Enquire about {t.name}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <section className="vx-pitch">
          <h2 className="vx-section-title">The investor pitch</h2>
          <div className="vx-pitch-grid">
            {pitch.map((s) => (
              <div key={s.slide} className="vx-pitch-slide">
                <span className="vx-pitch-num">{String(s.slide).padStart(2, "0")}</span>
                <h4>{s.title}</h4>
                {s.subtitle && <p className="vx-pitch-sub">{s.subtitle}</p>}
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="vx-enquiry">
          <h2 className="vx-section-title">Request the full deck & onboarding</h2>
          <form className="vx-enquiry-form" onSubmit={submit}>
            <div className="vx-form-row">
              <input required placeholder="Full name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input required type="email" placeholder="Email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="vx-form-row">
              <input type="number" min="0" placeholder="Amount (USD)" value={form.amount_usd}
                onChange={(e) => setForm({ ...form, amount_usd: e.target.value })} />
              <input placeholder="Country" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="private">Private</option>
              </select>
            </div>
            <button className="vx-btn-primary" type="submit" disabled={sent === "sending"}>
              {sent === "sending" ? "Sending…" : "Request the deck"}
            </button>
            {sent && sent !== "sending" && <p className="vx-banner vx-banner--success">{sent}</p>}
          </form>
        </section>

        {summary && <p className="vx-fineprint">{summary.disclaimer}</p>}
      </main>
    </div>
  );
}
