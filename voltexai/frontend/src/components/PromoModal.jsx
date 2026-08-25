// src/components/PromoModal.jsx — Investing.com-style conversion CTA.
// Full-screen promo shown once per session, remembered, dismissible.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const KEY = "vx_promo_seen_v1";

export function PromoModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
    if (seen || user) return;                     // don't nag logged-in users
    const t = setTimeout(() => setOpen(true), 2600);
    return () => clearTimeout(t);
  }, [user]);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  };

  if (!open) return null;
  return (
    <div className="vx-promo-backdrop" onClick={close}>
      <div className="vx-promo" onClick={(e) => e.stopPropagation()}>
        <button className="vx-promo-x" onClick={close} aria-label="Close">×</button>
        <div className="vx-promo-ribbon">LAUNCH OFFER · LAUNCH OFFER · LAUNCH OFFER</div>

        <div className="vx-promo-brand"><span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span></div>
        <h2 className="vx-promo-head">See the trade<br />before it happens</h2>
        <p className="vx-promo-sub">
          Stop guessing. <b>Voltex AI</b> scores every setup 0–100 and streams only the
          <b> A+ signals</b> — with entries, SL, TP1–TP4 and live management.
        </p>

        <div className="vx-promo-rating">
          <span className="vx-stars">★★★★★</span>
          <span className="vx-muted">4.8/5 · 48,000+ traders across 27 countries</span>
        </div>

        <ul className="vx-promo-list">
          <li>🔥 A+ setups only — weak signals auto-rejected</li>
          <li>🎯 1:3R+ TP ladder on every trade</li>
          <li>📲 Free & VIP Telegram + MT5 auto-execution</li>
          <li>📊 Verified win-rate &amp; performance dashboard</li>
        </ul>

        <Link to="/pricing" className="vx-promo-cta" onClick={close}>
          Get AI Trading Plans <span>→</span>
        </Link>
        <button className="vx-promo-dismiss" onClick={close}>Maybe later</button>
      </div>
    </div>
  );
}
