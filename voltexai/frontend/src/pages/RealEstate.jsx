// src/pages/RealEstate.jsx — VoltexAI Real Estate (fractional property investment)
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { useAuth } from "../contexts/AuthContext";
import { realEstateService } from "../services/ecosystem";

const money = (n) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

const AFRICA = ["Zambia", "Nigeria", "Kenya", "Uganda", "Ghana", "Tanzania", "South Africa"];

function PropertyCard({ p, onInvest }) {
  return (
    <div className="vx-re-card">
      <div className="vx-re-photo" style={{
        background: `radial-gradient(120% 120% at 20% 0%, ${p.accent}44, transparent 60%),
                     linear-gradient(160deg, #17202f, #0d1220)` }}>
        <span className="vx-re-yield" style={{ background: p.accent }}>{p.yield_pct}% yield</span>
        <span className="vx-re-soon">Coming soon</span>
        <span className="vx-re-loc">{p.flag} {p.city}, {p.country}</span>
        <span className="vx-re-pin" style={{ color: p.accent }}>📍</span>
      </div>
      <div className="vx-re-body">
        <div className="vx-re-top">
          <h3>{p.name}</h3>
          <span className="vx-muted">{p.type}</span>
        </div>
        <p className="vx-re-tagline">{p.tagline}</p>
        <div className="vx-re-fund">
          <div className="vx-re-bar"><span style={{ width: `${p.funded_pct}%`, background: p.accent }} /></div>
          <div className="vx-re-fund-meta">
            <b>{p.funded_pct}% reserved</b>
            <span className="vx-muted">{p.term_months}-mo term</span>
          </div>
        </div>
        <div className="vx-re-stats">
          <div><span>Property value</span><b>{money(p.price_usd)}</b></div>
          <div><span>Min. invest</span><b style={{ color: p.accent }}>{money(p.min_invest_usd)}</b></div>
          <div><span>Target yield</span><b>{p.yield_pct}%</b></div>
        </div>
        <button className="vx-btn-primary vx-btn-sm" style={{ width: "100%" }} onClick={() => onInvest(p)}>
          Reserve from {money(p.min_invest_usd)} →
        </button>
      </div>
    </div>
  );
}

function InvestModal({ p, launch, user, onClose }) {
  const [amount, setAmount] = useState(p.min_invest_usd);
  const [email, setEmail] = useState(user?.email || "");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const provider = AFRICA.includes(user?.country) ? "flutterwave" : "stripe";
  const rail = provider === "flutterwave" ? "Mobile money / card · Flutterwave" : "Card · Stripe";

  async function join() {
    setErr(""); setBusy(true);
    try {
      await realEstateService.interest({
        property_id: p.id, amount_usd: Number(amount) || p.min_invest_usd,
        email: email || undefined, provider, country: user?.country,
      });
      setDone(true);
    } catch (e) { setErr(e.message || "Could not join the waitlist."); }
    finally { setBusy(false); }
  }

  return (
    <div className="vx-modal-overlay" onClick={onClose}>
      <div className="vx-re-modal" onClick={(e) => e.stopPropagation()}>
        <button className="vx-modal-x" onClick={onClose} aria-label="Close">×</button>
        {done ? (
          <div className="vx-re-modal-done">
            <div className="vx-re-modal-icon">🏠</div>
            <h3>You're on the waitlist</h3>
            <p className="vx-muted">
              We'll notify you the moment <b>{p.name}</b> opens for investment — you'll be
              first in line, settling through VoltexAI Pay.
            </p>
            <button className="vx-btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <span className="vx-re-soon vx-re-soon--modal">{launch?.label || "Coming soon"}</span>
            <h3>Reserve your place · {p.name}</h3>
            <p className="vx-muted vx-re-modal-loc">{p.flag} {p.city}, {p.country} · {p.type} · {p.yield_pct}% target yield</p>

            <div className="vx-re-notice">
              <b>💡 {launch?.headline || "Launching soon"}</b>
              <p>{launch?.note || "Fractional property investment launches after our MOUs are signed."}</p>
            </div>

            <label className="vx-re-field">
              Amount you'd invest (USD)
              <input type="number" min={p.min_invest_usd} step="10" value={amount}
                     onChange={(e) => setAmount(e.target.value)} />
            </label>
            {!user && (
              <label className="vx-re-field">
                Email (so we can reach you at launch)
                <input type="email" value={email} placeholder="you@example.com"
                       onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}
            <div className="vx-re-pay">
              <span className="vx-muted">Settled at launch via</span>
              <span className="vx-re-rail">💳 VoltexAI Pay · {rail}</span>
            </div>

            {err && <div className="vx-error">{err}</div>}
            <button className="vx-btn-primary" style={{ width: "100%" }} disabled={busy} onClick={join}>
              {busy ? "Joining…" : "Join the waitlist →"}
            </button>
            <p className="vx-fineprint" style={{ marginTop: 10 }}>
              No payment is taken now. This reserves your interest — investing opens after the MOUs
              with property partners and regulators are finalised.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RealEstate() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [market, setMarket] = useState("all");
  const [invest, setInvest] = useState(null);   // property being reserved

  useEffect(() => { realEstateService.overview().then(setD).catch(() => {}); }, []);

  const properties = useMemo(() => {
    if (!d) return [];
    return market === "all" ? d.properties : d.properties.filter((p) => p.country === market);
  }, [d, market]);

  return (
    <div className="vx-page">
      <NavBar />

      {/* Hero */}
      <section className="vx-re-hero">
        <div className="vx-container vx-re-hero-in">
          <span className="vx-eyebrow">VoltexAI Real Estate · <span className="vx-re-soon-inline">{d?.launch?.label || "Coming soon"}</span></span>
          <h1>Turn trading gains into <span className="vx-grad">brick-and-mortar wealth.</span></h1>
          <p className="vx-re-sub">{d?.blurb ||
            "Co-invest in vetted, income-producing property across Africa and beyond — from $50, funded by card or mobile money, with rental yield paid to your VoltexAI wallet."}</p>
          <div className="vx-hero-cta">
            <a href="#deals" className="vx-btn-primary vx-btn-lg">Browse opportunities</a>
            <Link to="/signup" className="vx-btn-secondary vx-btn-lg">Start from $50</Link>
          </div>
          {d?.stats && (
            <div className="vx-re-statband">
              {d.stats.map((s) => (
                <div key={s.label} className="vx-re-stat">
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                  <small className="vx-muted">{s.note}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="vx-container">
        {/* Why */}
        <section className="vx-section">
          <h2 className="vx-section-title">Why invest through VoltexAI</h2>
          <div className="vx-feature-grid">
            {(d?.why || []).map((w) => (
              <div key={w.title} className="vx-feature-card">
                <span className="vx-feature-icon">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Deals */}
        <section id="deals" className="vx-section">
          <h2 className="vx-section-title vx-left">Live opportunities</h2>
          <div className="vx-class-tabs vx-re-tabs">
            <button className={market === "all" ? "active" : ""} onClick={() => setMarket("all")}>All markets</button>
            {(d?.markets || []).map((m) => (
              <button key={m} className={market === m ? "active" : ""} onClick={() => setMarket(m)}>{m}</button>
            ))}
          </div>
          <div className="vx-re-grid">
            {properties.map((p) => <PropertyCard key={p.id} p={p} onInvest={setInvest} />)}
          </div>
        </section>

        {/* How it works */}
        <section className="vx-section vx-section--alt">
          <h2 className="vx-section-title">How it works</h2>
          <div className="vx-steps">
            {(d?.steps || []).map(([t, b], i) => (
              <div key={t} className="vx-step">
                <span className="vx-step-num">{i + 1}</span>
                <h4>{t}</h4>
                <p>{b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="vx-cta-band">
          <span className="vx-re-soon vx-re-soon--band">{d?.launch?.label || "Coming soon"}</span>
          <h2>Be first when the doors open.</h2>
          <p>{d?.launch?.note ||
            "Fractional property investment launches after our MOUs with property partners and regulators are signed. Join the waitlist to reserve your place."}</p>
          <div className="vx-hero-cta">
            <button className="vx-btn-primary vx-btn-lg" onClick={() => setInvest(d?.properties?.[0])} disabled={!d}>
              Join the waitlist
            </button>
            <Link to="/aum" className="vx-btn-ghost vx-btn-lg">See Managed Alpha</Link>
          </div>
        </section>

        <p className="vx-fineprint">
          VoltexAI Real Estate opportunities are illustrative and for information only — not a solicitation
          or an offer of securities. Property investment carries risk; values and rental income can fall as
          well as rise. Do your own due diligence.
        </p>
      </main>
      {invest && <InvestModal p={invest} launch={d?.launch} user={user} onClose={() => setInvest(null)} />}
      <Footer />
    </div>
  );
}
