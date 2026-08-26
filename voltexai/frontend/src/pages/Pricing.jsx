// src/pages/Pricing.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { paymentsService } from "../services/payments";
import { useAuth } from "../contexts/AuthContext";

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [billing, setBilling] = useState(null);
  const [interval, setInterval] = useState("month"); // "month" | "year"
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const reason = params.get("reason");
  const checkoutStatus = params.get("checkout");
  const [region, setRegion] = useState(
    user?.country === "Zambia" || user?.country === "Nigeria" ||
    user?.country === "Kenya" || user?.country === "Uganda" ||
    user?.country === "Ghana" || user?.country === "Tanzania"
      ? "africa" : "international"
  );

  useEffect(() => {
    paymentsService.listPlans().then((r) => {
      // API returns { billing, plans }; tolerate a bare array for safety.
      const list = Array.isArray(r) ? r : r.plans;
      setPlans(list || []);
      if (!Array.isArray(r)) setBilling(r.billing);
    }).catch((e) => setError(e.message));
  }, []);

  const annual = interval === "year";

  async function startCheckout(plan, provider) {
    setError(""); setBusy(`${plan}-${provider}`);
    try {
      if (!user) { window.location.href = "/login"; return; }
      let res;
      if (provider === "stripe") {
        res = await paymentsService.stripeCheckout(plan, interval);
      } else {
        res = await paymentsService.flutterwaveCheckout({
          plan, interval, currency: "ZMW", phone: user.phone,
        });
      }
      window.location.href = res.checkout_url;
    } catch (e) {
      setError(e.message || "Checkout failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="vx-pricing">
      <header className="vx-pricing-header">
        <h1>Power up your trading.</h1>
        <p>Pick the plan that matches how active you are. Cancel anytime.</p>

        {reason === "upgrade" && (
          <div className="vx-banner vx-banner--info">
            That feature needs a paid plan. Pick one below to unlock it.
          </div>
        )}
        {checkoutStatus === "cancelled" && (
          <div className="vx-banner vx-banner--warn">
            Checkout cancelled — no charges made.
          </div>
        )}
        {checkoutStatus === "success" && (
          <div className="vx-banner vx-banner--success">
            Payment received — your plan is being activated. Refresh in a moment.
          </div>
        )}

        <div className="vx-region-toggle">
          <button
            className={region === "africa" ? "active" : ""}
            onClick={() => setRegion("africa")}
          >
            Africa · Mobile Money & ZMW
          </button>
          <button
            className={region === "international" ? "active" : ""}
            onClick={() => setRegion("international")}
          >
            International · Card (USD)
          </button>
        </div>

        <div className="vx-billing-toggle" role="group" aria-label="Billing period">
          <button
            className={!annual ? "active" : ""}
            onClick={() => setInterval("month")}
          >
            Monthly
          </button>
          <button
            className={annual ? "active" : ""}
            onClick={() => setInterval("year")}
          >
            Annual
            {billing?.discount_pct ? (
              <span className="vx-save-pill">Save {billing.discount_pct}%</span>
            ) : null}
          </button>
        </div>
        {annual && billing?.label && (
          <p className="vx-billing-note">Billed yearly — {billing.label}. Cancel anytime.</p>
        )}
      </header>

      {error && <div className="vx-error">{error}</div>}

      <div className="vx-plan-grid">
        {plans.map((p) => {
          const isCurrent = user?.plan === p.id;
          const isPaid = p.id !== "free";
          return (
            <div key={p.id} className={`vx-plan vx-plan--${p.id}`}>
              <div className="vx-plan-head">
                <h2>{p.name}</h2>
                {p.id === "elite" && <span className="vx-badge">Most powerful</span>}
                {p.id === "pro" && <span className="vx-badge vx-badge--accent">Popular</span>}
                {p.id === "starter" && <span className="vx-badge vx-badge--soft">Best value</span>}
              </div>
              {p.tagline && <p className="vx-plan-tagline">{p.tagline}</p>}
              {(() => {
                const africa = region === "africa";
                const cur = africa ? "K" : "$";
                const fmt = (n) => `${cur}${Math.round(n).toLocaleString()}`;
                // per-month figure shown as the headline
                const perMonth = africa
                  ? (annual ? p.zmw_annual / 12 : p.zmw)
                  : (annual ? p.usd_annual_monthly : p.usd);
                const yearTotal = africa ? p.zmw_annual : p.usd_annual;
                const saved = africa ? (p.zmw * 12 - p.zmw_annual) : p.annual_savings_usd;
                return (
                  <div className="vx-plan-price-wrap">
                    <div className="vx-plan-price">
                      <span className="vx-price-amount">
                        {p.id === "free" ? "Free" : fmt(perMonth)}
                      </span>
                      {isPaid && <span className="vx-price-period">/month</span>}
                    </div>
                    {isPaid && annual && (
                      <p className="vx-price-annual">
                        {fmt(yearTotal)} billed yearly
                        {saved > 0 && <span className="vx-price-saved"> · save {fmt(saved)}</span>}
                      </p>
                    )}
                    {isPaid && !annual && p.annual_discount_pct > 0 && (
                      <button className="vx-price-switch" onClick={() => setInterval("year")}>
                        Save {p.annual_discount_pct}% with annual
                      </button>
                    )}
                  </div>
                );
              })()}
              <ul className="vx-plan-features">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>

              {isCurrent ? (
                <button className="vx-btn-current" disabled>Current plan</button>
              ) : p.id === "free" ? (
                <a href="/signup" className="vx-btn-secondary">Start free</a>
              ) : region === "africa" ? (
                <button
                  className="vx-btn-primary"
                  disabled={busy === `${p.id}-flutterwave`}
                  onClick={() => startCheckout(p.id, "flutterwave")}
                >
                  {busy === `${p.id}-flutterwave` ? "Loading…" : "Pay with Mobile Money"}
                </button>
              ) : (
                <button
                  className="vx-btn-primary"
                  disabled={busy === `${p.id}-stripe`}
                  onClick={() => startCheckout(p.id, "stripe")}
                >
                  {busy === `${p.id}-stripe` ? "Loading…" : "Pay with Card"}
                </button>
              )}

              {p.id !== "free" && (
                <p className="vx-plan-finetext">
                  {region === "africa"
                    ? "MTN MoMo · Airtel Money · M-Pesa · Visa/Mastercard"
                    : "Visa · Mastercard · Amex · Secured by Stripe"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
