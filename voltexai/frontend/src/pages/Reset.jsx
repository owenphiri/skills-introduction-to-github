// src/pages/Reset.jsx
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../services/auth";

export default function Reset() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    setBusy(true);
    try {
      await authService.reset(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vx-auth-page">
      <div className="vx-auth-card">
        <header className="vx-auth-header">
          <h1>New password</h1>
        </header>
        {done ? (
          <div className="vx-success">
            <p>Password updated. Redirecting to sign in…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="vx-form">
            <label>
              New password
              <input
                type="password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <div className="vx-error">{error}</div>}
            <button disabled={busy} className="vx-btn-primary">
              {busy ? "Saving…" : "Update password"}
            </button>
            <Link to="/login" className="vx-link-secondary">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
