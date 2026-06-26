// src/pages/Pricing.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { paymentsService } from "../services/payments";
import { useAuth } from "../contexts/AuthContext";

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
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
    paymentsService.listPlans().then(setPlans).catch((e) => setError(e.message));
  }, []);

  async function startCheckout(plan, provider) {
    setError(""); setBusy(`${plan}-${provider}`);
    try {
      if (!user) { window.location.href = "/login"; return; }
      let res;
      if (provider === "stripe") {
        res = await paymentsService.stripeCheckout(plan);
      } else {
        res = await paymentsService.flutterwaveCheckout({
          plan, currency: "ZMW", phone: user.phone,
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
                {p.id === "trader" && <span className="vx-badge vx-badge--accent">Popular</span>}
              </div>
              <div className="vx-plan-price">
                {region === "africa" ? (
                  <>
                    <span className="vx-price-amount">
                      {p.id === "free" ? "Free" : `K${p.zmw.toLocaleString()}`}
                    </span>
                    {isPaid && <span className="vx-price-period">/month</span>}
                  </>
                ) : (
                  <>
                    <span className="vx-price-amount">
                      {p.id === "free" ? "Free" : `$${p.usd}`}
                    </span>
                    {isPaid && <span className="vx-price-period">/month</span>}
                  </>
                )}
              </div>
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
