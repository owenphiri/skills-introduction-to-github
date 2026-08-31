// src/pages/Store.jsx — Voltex Store
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { storeService } from "../services/ecosystem";
import { coinService } from "../services/coin";
import { useAuth } from "../contexts/AuthContext";

const CATS = [["all", "All"], ["plans", "Plans"], ["education", "Education"],
              ["tools", "Tools"], ["merch", "Merch"]];

const AFRICA = ["Zambia", "Nigeria", "Kenya", "Uganda", "Ghana", "Tanzania", "South Africa"];
const MAX_REDEEM_PCT = 30, VXC_PER_USD = 100;

// Client-side preview of the coin credit (server is the source of truth on charge).
function coinDiscount(priceUsd, balance) {
  const maxOff = priceUsd * (MAX_REDEEM_PCT / 100);
  return Math.round(Math.min(maxOff, (balance || 0) / VXC_PER_USD) * 100) / 100;
}

export default function Store() {
  const { user } = useAuth();
  const [cat, setCat] = useState("all");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [coins, setCoins] = useState(null);   // VXC balance

  useEffect(() => { storeService.list(cat).then((d) => setItems(d.products)).catch(() => {}); }, [cat]);
  useEffect(() => {
    if (user) coinService.wallet().then((w) => setCoins(w.balance)).catch(() => {});
  }, [user]);

  async function buy(p) {
    if (!user) { window.location.href = "/login"; return; }
    const provider = AFRICA.includes(user.country) ? "flutterwave" : "stripe";
    setErr(""); setBusy(p.id);
    try {
      const res = await storeService.checkout({ productId: p.id, provider, phone: user.phone, applyCoins: true });
      window.location.href = res.checkout_url;
    } catch (e) {
      setErr(e.message || "Checkout failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🛍️ Voltex Store</h1>
          <p className="vx-muted">Plans, education, trading tools and merch — checkout with Voltex Pay.</p>
        </div>
        {coins > 0 && (
          <div className="vx-coin-banner">
            🪙 You have <b>{coins.toLocaleString()} VXC</b> — up to <b>{MAX_REDEEM_PCT}% off</b> is
            applied automatically at checkout. <Link to="/coin" className="vx-inline-link">View wallet →</Link>
          </div>
        )}
        {err && <div className="vx-error">{err}</div>}
        <div className="vx-class-tabs">
          {CATS.map(([id, label]) => (
            <button key={id} className={cat === id ? "active" : ""} onClick={() => setCat(id)}>{label}</button>
          ))}
        </div>
        <div className="vx-card-grid">
          {items.map((p) => (
            <div key={p.id} className="vx-store-card vx-rise">
              {p.badge && <span className="vx-store-badge">{p.badge}</span>}
              <div className="vx-store-icon">{p.icon}</div>
              <h3>{p.name}</h3>
              <p className="vx-muted vx-store-desc">{p.desc}</p>
              <ul className="vx-store-features">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {p.category !== "plans" && coins > 0 && coinDiscount(p.price_usd, coins) > 0 && (
                <span className="vx-coin-save">🪙 −${coinDiscount(p.price_usd, coins)} with VXC → pay ${Math.round((p.price_usd - coinDiscount(p.price_usd, coins)) * 100) / 100}</span>
              )}
              <div className="vx-store-foot">
                <span className="vx-store-price">
                  ${p.price_usd}{p.period !== "once" && <small>/{p.period}</small>}
                </span>
                {p.category === "plans" ? (
                  <Link to="/pricing" className="vx-btn-primary vx-btn-sm">Choose</Link>
                ) : (
                  <button className="vx-btn-primary vx-btn-sm" disabled={busy === p.id}
                    onClick={() => buy(p)}>
                    {busy === p.id ? "…" : "Buy"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
