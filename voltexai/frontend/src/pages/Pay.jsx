// src/pages/Pay.jsx — Voltex Pay (payment infrastructure)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { payService } from "../services/ecosystem";

export default function Pay() {
  const [data, setData] = useState(null);
  useEffect(() => { payService.overview().then(setData).catch(() => {}); }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>💳 Voltex Pay</h1>
          <p className="vx-muted">
            Fund your journey your way. Mobile money, cards, PayPal and crypto — built
            Africa-first, settling in your local currency.
          </p>
        </div>

        {data && (
          <>
            <div className="vx-pay-grid">
              {data.methods.map((m) => (
                <div key={m.id} className={`vx-pay-card vx-rise ${m.live ? "" : "soon"}`}>
                  <div className="vx-pay-icon">{m.icon}</div>
                  <b>{m.name}</b>
                  <span className="vx-muted">{m.region}</span>
                  <span className={`vx-pay-status ${m.live ? "live" : "soon"}`}>
                    {m.live ? "● Live" : "○ Coming soon"}
                  </span>
                </div>
              ))}
            </div>
            <div className="vx-pay-info">
              <div className="vx-pay-ccy">
                <b>Settlement currencies</b>
                <div>{data.currencies.map((c) => <span key={c} className="vx-chip">{c}</span>)}</div>
              </div>
              <p className="vx-muted">{data.note}</p>
              <Link to="/pricing" className="vx-btn-primary">Go to checkout</Link>
            </div>
          </>
        )}
        <p className="vx-fineprint">
          Card & USD processed by Stripe; mobile money, bank transfer & more by
          Flutterwave. VoltexAI does not custody client funds.
        </p>
      </main>
      <Footer />
    </div>
  );
}
