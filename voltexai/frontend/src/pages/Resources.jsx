// src/pages/Resources.jsx — Voltex Resources (toolkit + economic calendar)
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { resourcesService } from "../services/hub";
import { KpiStrip } from "../components/Analytics";
import { Link } from "react-router-dom";

export default function Resources() {
  const [cat, setCat] = useState("all");
  const [data, setData] = useState(null);
  const [cal, setCal] = useState(null);

  useEffect(() => {
    resourcesService.list(cat).then(setData).catch(() => {});
  }, [cat]);

  useEffect(() => {
    resourcesService.calendar(7).then(setCal).catch(() => {});
  }, []);

  const cats = data ? ["all", ...data.categories] : ["all"];

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>📚 Voltex Resources</h1>
          <p className="vx-muted">
            The trader's toolkit — guides, cheat sheets, calculators and a
            high-impact economic calendar. Everything you need in one place.
          </p>
        </div>

        <KpiStrip ids={["academy", "products", "community", "sessions"]} title="Toolkit pulse" />

        <Link to="/calculators" className="vx-calc-cta">
          <div>
            <b>🧮 Advanced Trading Calculators</b>
            <span className="vx-muted">Lot sizing · entries &amp; exits · Fibonacci · pip value — hassle-free.</span>
          </div>
          <span className="vx-btn-primary vx-btn-sm">Open calculators →</span>
        </Link>

        <div className="vx-filter-row">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`vx-filter-chip ${cat === c ? "active" : ""}`}>
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        <div className="vx-resource-grid">
          {data?.resources.map((r) => (
            <div key={r.id} className="vx-resource-card">
              <span className="vx-resource-icon">{r.icon}</span>
              <div>
                <b>{r.title}</b>
                <p className="vx-muted">{r.desc}</p>
                <span className="vx-chip">{r.kind}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 className="vx-section-title">📅 High-impact economic calendar</h2>
        <div className="vx-cal-table">
          {cal?.events.map((e, i) => (
            <div key={i} className="vx-cal-row">
              <span className="vx-cal-date">{e.date}</span>
              <span className="vx-cal-time">{e.time_utc}</span>
              <span className="vx-cal-ccy">{e.currency}</span>
              <span className="vx-cal-event">{e.event}</span>
              <span className={`vx-impact vx-impact--${e.impact}`}>{e.impact}</span>
            </div>
          ))}
          {cal && cal.events.length === 0 && (
            <p className="vx-muted">No high-impact events in the next 7 days.</p>
          )}
        </div>
        <p className="vx-fineprint">Calendar times are UTC and indicative. Always confirm against your broker feed.</p>
      </main>
      <Footer />
    </div>
  );
}
