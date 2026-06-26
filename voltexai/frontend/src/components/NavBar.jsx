// src/components/NavBar.jsx — shared top navigation + live ticker
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LiveTicker } from "./LiveTicker";

const LINKS = [
  { to: "/markets", label: "Markets" },
  { to: "/signals", label: "Signals" },
  { to: "/trade", label: "Trade" },
  { to: "/terminal", label: "AI Terminal" },
  { to: "/prop-firms", label: "Prop Firms" },
  { to: "/brokers", label: "Brokers" },
  { to: "/aum", label: "AUM" },
  { to: "/pricing", label: "Pricing" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="vx-nav">
      <div className="vx-nav-inner">
        <Link to="/" className="vx-logo">
          <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
        </Link>
        <nav className="vx-nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => `vx-nav-link ${isActive ? "active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="vx-nav-actions">
          {user ? (
            <>
              <Link to="/account" className="vx-nav-user">
                {user.full_name?.split(" ")[0] || "Account"}
                <span className={`vx-plan-chip vx-plan-chip--${user.plan || "free"}`}>
                  {(user.plan || "free").toUpperCase()}
                </span>
              </Link>
              <button className="vx-btn-ghost" onClick={async () => { await logout(); navigate("/"); }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="vx-btn-ghost">Log in</Link>
              <Link to="/signup" className="vx-btn-primary vx-btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
      <LiveTicker />
    </header>
  );
}
