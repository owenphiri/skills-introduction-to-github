// src/pages/Wallet.jsx — Voltex Coin wallet: earn, redeem, and the BTC/ETH roadmap
import { useEffect, useState } from "react";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { coinService } from "../services/coin";

const REASON_ICON = {
  signup_bonus: "🎁", verify_email: "✅", daily_checkin: "📅", journal_trade: "📓",
  academy_lesson: "🎓", referral_signup: "🤝", first_purchase: "🛒",
  purchase_cashback: "💸",
};

function fmt(n) { return (n ?? 0).toLocaleString(); }

export default function Wallet() {
  const [w, setW] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => coinService.wallet().then(setW).catch(() => {});
  useEffect(() => { load(); }, []);

  const checkin = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await coinService.checkin();
      setMsg(r.claimed ? `+${r.earned} VXC — see you tomorrow!` : "Already claimed today ✓");
      await load();
    } catch { setMsg("Could not check in right now."); }
    finally { setBusy(false); }
  };

  const chain = w?.chain;

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <span className="vx-eyebrow">VoltexAI Rewards</span>
          <h1>🪙 Voltex Coin</h1>
          <p className="vx-muted">
            Earn VXC across the ecosystem, spend it on real discounts — and it's built
            chain-ready for a future bridge to Bitcoin and Ethereum.
          </p>
        </div>

        {/* Balance card */}
        <div className="vx-coin-balance">
          <div>
            <span className="vx-coin-label">Your balance</span>
            <div className="vx-coin-amount">{fmt(w?.balance)} <b>VXC</b></div>
            <span className="vx-muted">≈ ${w?.usd_value ?? "0.00"} in-app value · {w?.peg_vxc_per_usd || 100} VXC = $1</span>
          </div>
          <div className="vx-coin-actions">
            <button className="vx-btn-primary" onClick={checkin} disabled={busy}>
              📅 Daily check-in
            </button>
            {w?.cashback_multiplier > 1 && (
              <span className="vx-chip vx-chip--accent">
                {w.cashback_multiplier}× cashback boost active
              </span>
            )}
          </div>
        </div>
        {msg && <p className="vx-coin-msg">{msg}</p>}

        {/* Earn ways */}
        <h2 className="vx-section-title vx-left">Ways to earn</h2>
        <div className="vx-coin-grid">
          {(w?.earn_ways || []).map((e) => (
            <div key={e.reason} className="vx-coin-earn">
              <span className="vx-coin-earn-icon">{REASON_ICON[e.reason] || "⚡"}</span>
              <div>
                <b>{e.label}</b>
                <p className="vx-muted">{e.how}</p>
              </div>
              <span className="vx-coin-reward">+{fmt(e.reward)}</span>
            </div>
          ))}
          <div className="vx-coin-earn">
            <span className="vx-coin-earn-icon">💸</span>
            <div>
              <b>Purchase cashback</b>
              <p className="vx-muted">Every plan or store buy pays back {w?.cashback_pct || 5}% in VXC</p>
            </div>
            <span className="vx-coin-reward">{w?.cashback_pct || 5}%</span>
          </div>
        </div>

        {/* Redeem */}
        <h2 className="vx-section-title vx-left">Redeem your coins</h2>
        <div className="vx-panel vx-coin-redeem">
          <p>
            Spend VXC for real credit — coins can cover up to <b>{w?.max_redeem_pct || 30}%</b> of
            any VoltexAI checkout (plans, courses, tools). At {w?.peg_vxc_per_usd || 100} VXC = $1,
            your <b>{fmt(w?.balance)} VXC</b> is worth <b>${w?.usd_value ?? "0.00"}</b> off.
          </p>
          <p className="vx-muted">Apply your balance automatically at checkout on the Pricing and Store pages.</p>
        </div>

        {/* History */}
        {w?.history?.length > 0 && (
          <>
            <h2 className="vx-section-title vx-left">Recent activity</h2>
            <div className="vx-table-wrap">
              <table className="vx-table">
                <thead><tr><th>Activity</th><th>Amount</th><th>Balance</th></tr></thead>
                <tbody>
                  {w.history.map((h, i) => (
                    <tr key={i}>
                      <td>{REASON_ICON[h.reason] || "•"} {h.reason.replace(/_/g, " ")}</td>
                      <td className={h.amount >= 0 ? "vx-up" : "vx-down"}>
                        {h.amount >= 0 ? "+" : ""}{fmt(h.amount)} VXC
                      </td>
                      <td>{fmt(h.balance_after)} VXC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Chain-ready roadmap */}
        {chain && (
          <>
            <h2 className="vx-section-title vx-left">Built chain-ready 🔗</h2>
            <div className="vx-coin-chain">
              <div className="vx-coin-proto">
                <div className="vx-coin-proto-head"><span>Ξ</span><b>Ethereum · {chain.protocols.ethereum.standard}</b>
                  <span className="vx-chip">{chain.protocols.ethereum.status}</span></div>
                <p className="vx-muted">{chain.protocols.ethereum.role}</p>
              </div>
              <div className="vx-coin-proto">
                <div className="vx-coin-proto-head"><span>₿</span><b>Bitcoin · {chain.protocols.bitcoin.standard}</b>
                  <span className="vx-chip">{chain.protocols.bitcoin.status}</span></div>
                <p className="vx-muted">{chain.protocols.bitcoin.role}</p>
              </div>
            </div>
            <p className="vx-fineprint">{chain.disclaimer}</p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
