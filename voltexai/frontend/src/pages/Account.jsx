// src/pages/Account.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { paymentsService } from "../services/payments";
import { aiService } from "../services/ai";

export default function Account() {
  const { user, refreshUser, logout } = useAuth();
  const [quota, setQuota] = useState(null);
  const [refund, setRefund] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    aiService.quota().then(setQuota).catch(() => {});
    paymentsService.refundEligibility().then(setRefund).catch(() => {});
  }, []);

  async function cancel() {
    if (!confirm("Cancel your VoltexAI subscription? You'll keep access until the period ends.")) return;
    setBusy(true); setMsg("");
    try {
      const res = await paymentsService.cancel();
      setMsg(res.message);
      await refreshUser();
    } catch (e) {
      setMsg(e.message || "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestRefund() {
    if (!confirm("Request a full refund of your annual plan? This cancels your subscription and returns you to the Free plan.")) return;
    setBusy(true); setMsg("");
    try {
      const res = await paymentsService.requestRefund();
      setMsg(res.message);
      setRefund({ eligible: false });
      await refreshUser();
    } catch (e) {
      setMsg(e.message || "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="vx-account">
      <h1>Account</h1>

      <section className="vx-card">
        <h2>Profile</h2>
        <dl className="vx-dl">
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Name</dt><dd>{user.full_name || "—"}</dd>
          <dt>Country</dt><dd>{user.country || "—"}</dd>
          <dt>Phone</dt><dd>{user.phone || "—"}</dd>
          <dt>Member since</dt><dd>{new Date(user.created_at).toLocaleDateString()}</dd>
        </dl>
      </section>

      <section className="vx-card">
        <h2>Plan</h2>
        <p className="vx-plan-pill vx-plan-pill--{user.plan}">
          {user.plan.toUpperCase()} · {user.plan_status}
        </p>
        {quota && (
          <p>
            AI usage today: <strong>{quota.used} / {quota.limit}</strong>
            {" "}({quota.remaining} remaining)
          </p>
        )}
        <div className="vx-account-actions">
          <a href="/pricing" className="vx-btn-secondary">
            {user.plan === "free" ? "Upgrade" : "Change plan"}
          </a>
          {user.plan !== "free" && (
            <button onClick={cancel} disabled={busy} className="vx-btn-danger">
              {busy ? "Cancelling…" : "Cancel subscription"}
            </button>
          )}
        </div>
        {refund?.eligible && (
          <div className="vx-refund-box">
            <p>
              <strong>🛡 {refund.moneyback_days}-day money-back guarantee.</strong>{" "}
              You're within the window ({refund.days_left} day{refund.days_left === 1 ? "" : "s"} left).
              Not satisfied? Get a full refund of your annual plan — no questions asked.
            </p>
            <button onClick={requestRefund} disabled={busy} className="vx-btn-secondary">
              {busy ? "Processing…" : "Request refund"}
            </button>
          </div>
        )}
        {msg && <div className="vx-info">{msg}</div>}
      </section>

      <section className="vx-card">
        <button onClick={logout} className="vx-btn-secondary">Sign out</button>
      </section>
    </div>
  );
}
