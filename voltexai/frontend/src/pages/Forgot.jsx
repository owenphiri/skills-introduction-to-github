// src/pages/Forgot.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await authService.forgot(email.trim().toLowerCase());
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vx-auth-page">
      <div className="vx-auth-card">
        <header className="vx-auth-header">
          <h1>Reset password</h1>
          <p className="vx-auth-tag">We'll email you a reset link.</p>
        </header>

        {done ? (
          <div className="vx-success">
            <p>If that email is registered, a reset link is on its way.</p>
            <Link to="/login" className="vx-btn-primary">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="vx-form">
            <label>
              Email
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button disabled={busy} className="vx-btn-primary">
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <Link to="/login" className="vx-link-secondary">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
