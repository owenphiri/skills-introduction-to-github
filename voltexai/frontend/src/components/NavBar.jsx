// src/components/NavBar.jsx — shared top navigation + live ticker
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BrandLogo } from "./BrandLogo";
import { useI18n } from "../i18n";
import { LanguageSelector } from "./LanguageSelector";
import { LiveTicker } from "./LiveTicker";

const LINKS = [
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/markets", key: "nav.markets" },
  { to: "/signals", key: "nav.signals" },
  { to: "/pro-signals", key: "nav.signalsPro" },
  { to: "/patterns", key: "nav.patterns" },
  { to: "/topdown", key: "nav.topdown" },
  { to: "/sentiment", key: "nav.sentiment" },
  { to: "/journal", key: "nav.journal" },
  { to: "/eas", key: "nav.eas" },
  { to: "/coin", key: "nav.coin" },
  { to: "/live", key: "nav.live" },
  { to: "/academy", key: "nav.academy" },
  { to: "/community", key: "nav.community" },
  { to: "/resources", key: "nav.resources" },
  { to: "/products", key: "nav.ecosystem" },
  { to: "/about", key: "nav.company" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <header className="vx-nav">
      <div className="vx-nav-inner">
        <Link to="/" className="vx-logo"><BrandLogo /></Link>
        <nav className="vx-nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => `vx-nav-link ${isActive ? "active" : ""}`}>
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="vx-nav-actions">
          <LanguageSelector compact />
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin/signals" className="vx-btn-ghost vx-btn-sm">🛠️ {t("action.admin")}</Link>
              )}
              <Link to="/account" className="vx-nav-user">
                {user.full_name?.split(" ")[0] || t("action.account")}
                <span className={`vx-plan-chip vx-plan-chip--${user.plan || "free"}`}>
                  {(user.plan || "free").toUpperCase()}
                </span>
              </Link>
              <button className="vx-btn-ghost" onClick={async () => { await logout(); navigate("/"); }}>
                {t("action.signout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="vx-btn-ghost">{t("action.login")}</Link>
              <Link to="/signup" className="vx-btn-primary vx-btn-sm">{t("action.getStarted")}</Link>
            </>
          )}
        </div>
      </div>
      <LiveTicker />
    </header>
  );
}
