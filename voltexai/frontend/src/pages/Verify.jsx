// src/pages/Verify.jsx — email verification landing (linked from the verify email)
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authService } from "../services/auth";

export default function Verify() {
  const [params] = useSearchParams();
  const [state, setState] = useState("verifying"); // verifying | ok | error
  const token = params.get("token");

  useEffect(() => {
    if (!token) { setState("error"); return; }
    authService.verify(token).then(() => setState("ok")).catch(() => setState("error"));
  }, [token]);

  return (
    <div className="vx-auth-page">
      <div className="vx-auth-card vx-center">
        <div className="vx-logo" style={{ marginBottom: 16 }}>
          <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
        </div>
        {state === "verifying" && <p className="vx-muted">Verifying your email…</p>}
        {state === "ok" && (
          <>
            <h2>You're verified ✅</h2>
            <p className="vx-muted">Your account is fully unlocked. Welcome to the team.</p>
            <Link to="/terminal" className="vx-btn-primary vx-btn-block" style={{ marginTop: 16 }}>
              Open the terminal
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <h2>Link invalid or expired</h2>
            <p className="vx-muted">Log in and we'll send a fresh verification link.</p>
            <Link to="/login" className="vx-btn-secondary vx-btn-block" style={{ marginTop: 16 }}>
              Go to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
