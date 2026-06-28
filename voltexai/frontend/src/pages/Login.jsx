// src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/terminal";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vx-auth-page">
      <div className="vx-auth-card">
        <header className="vx-auth-header">
          <h1>VoltexAI</h1>
          <p className="vx-auth-tag">AI trading terminal · built in Africa</p>
        </header>

        <form onSubmit={onSubmit} className="vx-form">
          <label>
            Email
            <input
              type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <div className="vx-error">{error}</div>}

          <button type="submit" disabled={busy} className="vx-btn-primary">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="vx-auth-links">
          <Link to="/forgot">Forgot password?</Link>
          <span>·</span>
          <Link to="/signup">Create account</Link>
        </div>
      </div>
    </div>
  );
}
