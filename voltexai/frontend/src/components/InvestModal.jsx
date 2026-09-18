// src/components/InvestModal.jsx — VoltexAI Real Estate waitlist / Pay flow (Coming soon)
import { useState } from "react";
import { realEstateService } from "../services/ecosystem";

const AFRICA = ["Zambia", "Nigeria", "Kenya", "Uganda", "Ghana", "Tanzania", "South Africa"];
const money = (n) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

export function InvestModal({ p, launch, user, onClose }) {
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

export { money as fmtMoney };
