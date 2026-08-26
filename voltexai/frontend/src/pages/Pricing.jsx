// src/pages/Pricing.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { paymentsService } from "../services/payments";
import { useAuth } from "../contexts/AuthContext";
import { Testimonials } from "../components/Testimonials";

const PRICING_FAQ = [
  { q: "Is there really a free plan?",
    a: "Yes — Free is free forever. You get 10 AI Copilot calls a day, delayed market prices, community access and live-session replays, with no card required to start." },
  { q: "What's the difference between monthly and annual billing?",
    a: "Same features either way. Annual gives you 2 months free (about 17% off): you pay for 10 months up front and get the full year. You can switch between monthly and annual with the toggle above." },
  { q: "Can I upgrade or downgrade later?",
    a: "Anytime. Upgrades unlock the new tier's products immediately; downgrades take effect at the end of your current billing period, so you keep what you paid for until then." },
  { q: "How do I pay?",
    a: "Internationally, by card (Visa, Mastercard, Amex) through Stripe. In Africa, by mobile money — MTN MoMo, Airtel Money, M-Pesa — or local cards through Flutterwave, billed in ZMW and other local currencies." },
  { q: "Which plans include VIP Pro Signals?",
    a: "VIP Pro Signals — the Free and VIP Telegram channels plus in-app feed — are included from the Trader tier upward (Trader, Pro and Elite). Starter is a learn-the-markets tier without live signals or execution." },
  { q: "Can I cancel anytime?",
    a: "Yes. Cancel whenever you like and you keep full access through the end of the period you've already paid for — no lock-in, no cancellation fees." },
  { q: "Do you charge in my local currency?",
    a: "Prices are set in USD and shown in Zambian Kwacha (and other local currencies) for African customers. Flip the Africa / International toggle above to see your region's pricing." },
  { q: "What happens when I hit my daily AI limit?",
    a: "Each tier has a daily AI Copilot allowance (10 on Free up to 2,500 on Elite). If you reach it, the Copilot pauses until the next day — everything else on your plan keeps working. Upgrade any time for a higher limit." },
];

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
          <p className="vx-billing-note">
            Billed yearly — {billing.label}.
            {billing.moneyback_days > 0
              ? ` ${billing.moneyback_days}-day money-back guarantee.`
              : " Cancel anytime."}
          </p>
        )}

        <div className="vx-pricing-trust">
          <span className="vx-trust-stars" aria-hidden="true">★★★★★</span>
          <span className="vx-trust-text">
            <b>4.8/5</b> from traders in <b>14+ countries</b>
          </span>
          {billing?.discount_pct ? (
            annual ? (
              <span className="vx-trust-chip is-on">✓ Saving {billing.discount_pct}% with annual</span>
            ) : (
              <button className="vx-trust-chip" onClick={() => setInterval("year")}>
                Save {billing.discount_pct}% — switch to annual
              </button>
            )
          ) : null}
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
                    {isPaid && annual && billing?.moneyback_days > 0 && (
                      <span className="vx-guarantee-badge">
                        🛡 {billing.moneyback_days}-day money-back guarantee
                      </span>
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

      <section className="vx-pricing-social">
        <div className="vx-pricing-social-head">
          <span className="vx-eyebrow">Loved across the globe</span>
          <h2>Traders who bet on themselves — and won.</h2>
          <p className="vx-muted">
            Join a community spanning 14+ countries. Trade Smart. Trade Safe. Trade Consistently.
          </p>
        </div>
        <Testimonials limit={3} />
      </section>

      <section className="vx-pricing-faq">
        <div className="vx-pricing-social-head">
          <span className="vx-eyebrow">Questions</span>
          <h2>Everything you need to know</h2>
        </div>
        <div className="vx-faq-list">
          {(billing?.moneyback_days > 0
            ? [{ q: `Is there a money-back guarantee?`,
                 a: `Yes — every annual plan is covered by a ${billing.moneyback_days}-day money-back guarantee. If VoltexAI isn't for you, tell us within ${billing.moneyback_days} days of your annual purchase and we'll refund you in full, no questions asked.` },
               ...PRICING_FAQ]
            : PRICING_FAQ
          ).map((f, i) => (
            <details key={i} className="vx-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="vx-pricing-cta">
        <div>
          <h2>Financial freedom — bridging the gap.</h2>
          <p>
            Start free today, upgrade the moment you're ready. Every paid plan is
            month-to-month or annual (save 17%), and you can cancel anytime.
          </p>
        </div>
        <div className="vx-pricing-cta-actions">
          {user ? (
            <a href="#top" className="vx-btn-primary" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              Choose your plan
            </a>
          ) : (
            <>
              <a href="/signup" className="vx-btn-primary">Get started free</a>
              <a href="/login" className="vx-btn-secondary">I already have an account</a>
            </>
          )}
          <small className="vx-muted">
            No card required to start · Cancel anytime
            {billing?.moneyback_days > 0 && ` · ${billing.moneyback_days}-day money-back on annual`}
          </small>
        </div>
      </section>
    </div>
  );
}
