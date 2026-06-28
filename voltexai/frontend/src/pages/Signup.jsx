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
    <div className="vx-auth-page">
      <div className="vx-auth-card vx-auth-card--wide">
        <header className="vx-auth-header">
          <h1>Join VoltexAI</h1>
          <p className="vx-auth-tag">Free plan · 10 AI calls/day · upgrade anytime</p>
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
            {busy ? "Creating account…" : "Create free account"}
          </button>
        </form>

        <div className="vx-auth-links">
          <span>Already a member?</span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
