// src/pages/Signup.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const COUNTRIES = [
  "Zambia", "Nigeria", "Kenya", "Uganda", "South Africa",
  "Ghana", "Tanzania", "Rwanda", "Botswana", "Zimbabwe",
  "Other",
];

export default function Signup() {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "",
    country: "Zambia", phone: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      navigate("/terminal", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vx-auth-page vx-signup-split">
      <aside className="vx-join-panel">
        <span className="vx-eyebrow">⚡ Join the winning team</span>
        <h2>Stop guessing. <span className="vx-grad">Start trading with an edge.</span></h2>
        <p className="vx-join-sub">
          Africa's AI trading terminal puts pro-grade signals, live markets and a real
          trade desk in your pocket — funded by mobile money, built for you.
        </p>
        <ul className="vx-join-benefits">
          <li>🧠 <b>AI that mentors you</b> — Claude-powered analysis & ICT/SMC academy</li>
          <li>⚡ <b>Signals that mean business</b> — ranked setups with entry, stop & targets</li>
          <li>💹 <b>Trade risk-free today</b> — paper desk with $100k, go live when you're ready</li>
          <li>📈 <b>Real-time markets</b> — forex, crypto, metals, indices & stocks</li>
          <li>💳 <b>Pay your way</b> — MTN, Airtel, M-Pesa or card</li>
        </ul>
        <div className="vx-join-proof">
          <span>Free forever plan</span><span>·</span>
          <span>No card required</span><span>·</span>
          <span>30-second signup</span>
        </div>
      </aside>

      <div className="vx-auth-card vx-auth-card--wide">
        <header className="vx-auth-header">
          <h1>Create your free account</h1>
          <p className="vx-auth-tag">⚡ You're 30 seconds from the terminal — no card, cancel anytime</p>
        </header>

        <form onSubmit={onSubmit} className="vx-form">
          <label>
            Full name
            <input
              type="text" autoComplete="name"
              value={form.full_name} onChange={update("full_name")}
              placeholder="Owen Phiri"
            />
          </label>
          <label>
            Email
            <input
              type="email" required autoComplete="email"
              value={form.email} onChange={update("email")}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password" required minLength={8}
              autoComplete="new-password"
              value={form.password} onChange={update("password")}
              placeholder="At least 8 characters"
            />
          </label>
          <div className="vx-form-row">
            <label>
              Country
              <select value={form.country} onChange={update("country")}>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Mobile (for MoMo payments)
              <input
                type="tel" autoComplete="tel"
                value={form.phone} onChange={update("phone")}
                placeholder="+260977123456"
              />
            </label>
          </div>

          {error && <div className="vx-error">{error}</div>}

          <button type="submit" disabled={busy} className="vx-btn-primary">
            {busy ? "Creating account…" : "Claim my free account →"}
          </button>
          <p className="vx-join-microcopy">
            Join traders across Zambia, Nigeria, Kenya, Ghana & South Africa. Trade smart,
            trade safe, trade consistently.
          </p>
        </form>

        <div className="vx-auth-links">
          <span>Already a member?</span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
