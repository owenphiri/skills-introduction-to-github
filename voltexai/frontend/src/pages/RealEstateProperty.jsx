// src/pages/RealEstateProperty.jsx — property prospectus (detail page)
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { useAuth } from "../contexts/AuthContext";
import { realEstateService } from "../services/ecosystem";
import { InvestModal, fmtMoney as money } from "../components/InvestModal";

export default function RealEstateProperty() {
  const { id } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [launch, setLaunch] = useState(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    realEstateService.property(id)
      .then((r) => { setD(r.property); setLaunch(r.launch); })
      .catch(() => setErr(true));
  }, [id]);

  if (err) return (
    <div className="vx-page"><NavBar /><main className="vx-container">
      <div className="vx-page-head"><h1>Property not found</h1>
        <p className="vx-muted">This opportunity may have closed. <Link className="vx-inline-link" to="/real-estate">Back to Real Estate →</Link></p>
      </div></main><Footer /></div>
  );
  if (!d) return (
    <div className="vx-page"><NavBar /><main className="vx-container">
      <p className="vx-muted" style={{ padding: "40px 0" }}>Loading prospectus…</p></main></div>
  );

  const facts = [
    ["Property value", money(d.price_usd)],
    ["Minimum investment", money(d.min_invest_usd)],
    ["Target yield (net p.a.)", `${d.yield_pct}%`],
    ["Term", `${d.term_months} months`],
    ["Reserved", `${d.funded_pct}%`],
    ["Type", d.type],
  ];

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <p className="vx-re-crumb"><Link to="/real-estate" className="vx-inline-link">← VoltexAI Real Estate</Link></p>

        {/* Prospectus hero */}
        <div className="vx-re-detail-hero" style={{
          background: `radial-gradient(120% 120% at 15% 0%, ${d.accent}3a, transparent 55%),
                       linear-gradient(160deg, #17202f, #0d1220)` }}>
          <span className="vx-re-soon vx-re-soon--modal" style={{ position: "static" }}>{launch?.label || "Coming soon"}</span>
          <span className="vx-re-yield" style={{ position: "static", background: d.accent, marginLeft: 8 }}>{d.yield_pct}% yield</span>
          <h1>{d.name}</h1>
          <p className="vx-re-detail-loc">{d.flag} {d.city}, {d.country} · {d.type}</p>
          <p className="vx-re-detail-summary">{d.summary || d.tagline}</p>
          <div className="vx-re-cta-row">
            <button className="vx-btn-primary" onClick={() => setOpen(true)}>Reserve from {money(d.min_invest_usd)}</button>
            <span className="vx-muted" style={{ alignSelf: "center", fontSize: 13 }}>No payment now · waitlist only</span>
          </div>
        </div>

        {/* Key facts */}
        <section className="vx-section" style={{ paddingTop: 32 }}>
          <div className="vx-re-facts">
            {facts.map(([k, v]) => (
              <div key={k} className="vx-re-fact"><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
        </section>

        <div className="vx-re-detail-grid">
          {/* Highlights */}
          <section>
            <h2 className="vx-section-title vx-left">Investment highlights</h2>
            <ul className="vx-re-highlights">
              {(d.highlights || []).map((h) => <li key={h}>{h}</li>)}
            </ul>
            <div className="vx-re-fund" style={{ marginTop: 20 }}>
              <div className="vx-re-bar"><span style={{ width: `${d.funded_pct}%`, background: d.accent }} /></div>
              <div className="vx-re-fund-meta"><b>{d.funded_pct}% reserved</b><span className="vx-muted">via the waitlist</span></div>
            </div>
            {d.sponsor && <p className="vx-muted" style={{ marginTop: 14, fontSize: 13.5 }}>Sponsor / partner: <b>{d.sponsor}</b></p>}
          </section>

          {/* Illustrative returns */}
          <section>
            <h2 className="vx-section-title vx-left">Illustrative returns</h2>
            <p className="vx-muted" style={{ fontSize: 13.5, marginTop: -8 }}>
              On a minimum {money(d.min_invest_usd)} stake at the {d.yield_pct}% target yield — approx.
              <b> {money(d.min_yield_income)}</b>/year in rental income (before fees). Illustrative, not guaranteed.
            </p>
            <div className="vx-table-wrap" style={{ marginTop: 12 }}>
              <table className="vx-table">
                <thead><tr><th>Year</th><th>Cumulative income</th></tr></thead>
                <tbody>
                  {(d.projection || []).map((r) => (
                    <tr key={r.year}><td>Year {r.year}</td><td>{money(r.income)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* MOU notice */}
        <div className="vx-re-notice" style={{ margin: "8px 0 24px" }}>
          <b>💡 {launch?.headline || "Launching soon"}</b>
          <p>{launch?.note}</p>
        </div>

        <p className="vx-fineprint">
          This prospectus is illustrative and for information only — not a solicitation or an offer of
          securities. Figures are targets, not guarantees; property values and rental income can fall as
          well as rise. Full offer terms follow the signing of MOUs with property partners and regulators.
        </p>
      </main>
      {open && <InvestModal p={d} launch={launch} user={user} onClose={() => setOpen(false)} />}
      <Footer />
    </div>
  );
}
