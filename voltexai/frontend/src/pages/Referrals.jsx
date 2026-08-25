// src/pages/Referrals.jsx — affiliate dashboard
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { referralsService } from "../services/hub";

function Copyable({ label, value }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="vx-copy-row">
      <span className="vx-muted">{label}</span>
      <code>{value}</code>
      <button className="vx-btn-ghost vx-btn-sm" onClick={copy}>{done ? "Copied ✓" : "Copy"}</button>
    </div>
  );
}

export default function Referrals() {
  const [d, setD] = useState(null);
  useEffect(() => { referralsService.me().then(setD).catch(() => {}); }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">Affiliate Program</span>
          <h1>🎁 Refer &amp; Earn</h1>
          <p className="vx-muted">
            Share VoltexAI and earn {d?.commission || "20%"} commission in Telegram Stars
            every time someone you refer goes VIP. Every day a payday.
          </p>
        </div>

        {!d && <p className="vx-muted">Loading your affiliate desk…</p>}
        {d && (
          <>
            <div className="vx-perf-strip">
              <div className="vx-perf"><b>{d.clicks}</b><span>Clicks</span></div>
              <div className="vx-perf"><b>{d.signups}</b><span>Signups</span></div>
              <div className="vx-perf"><b>{d.conversions}</b><span>VIP conversions</span></div>
              <div className="vx-perf"><b className="vx-up">{d.earned_stars}⭐</b><span>Earned</span></div>
              <div className="vx-perf"><b>{d.commission}</b><span>Commission</span></div>
            </div>

            <div className="vx-panel">
              <h3>Your links</h3>
              <Copyable label="Referral code" value={d.code} />
              <Copyable label="Website link" value={d.link} />
              <Copyable label="Telegram link" value={d.telegram_link} />
            </div>

            <h2 className="vx-section-title">Your referrals</h2>
            <div className="vx-admin-list">
              {d.referrals.length === 0 && <p className="vx-muted">No referrals yet — share your link to start earning.</p>}
              {d.referrals.map((r, i) => (
                <div key={i} className="vx-admin-row">
                  <div className="vx-admin-main">
                    <b>{r.via === "telegram" ? "📲 Telegram" : "🌐 Web"} referral</b>
                    <span className="vx-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className={`vx-sig-status ${r.status === "qualified" ? "s-closed" : ""}`}>{r.status}</span>
                    {r.reward_stars > 0 && <b className="vx-up" style={{ marginLeft: ".5rem" }}>+{r.reward_stars}⭐</b>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="vx-fineprint">Commissions are paid in Telegram Stars on qualifying VIP conversions. Self-referrals don't qualify.</p>
      </main>
      <Footer />
    </div>
  );
}
