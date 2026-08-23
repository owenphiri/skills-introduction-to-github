// src/components/Company.jsx — shared building blocks for corporate/media pages
import { useEffect, useState } from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";
import { SocialBar } from "./Social";
import { companyService } from "../services/company";

// Color-coded "cardinal" fancy phrases — an animated color band.
export function CardinalPhrases({ phrases = [] }) {
  if (!phrases.length) return null;
  const loop = [...phrases, ...phrases];
  return (
    <div className="vx-cardinal" aria-hidden="true">
      <div className="vx-cardinal-track">
        {loop.map((p, i) => (
          <span key={i} className="vx-cardinal-phrase" style={{ color: p.color }}>
            {p.text}<em>✦</em>
          </span>
        ))}
      </div>
    </div>
  );
}

// "Across the globe" presence strip.
export function GlobalStrip({ presence }) {
  if (!presence) return null;
  return (
    <section className="vx-global">
      <div className="vx-global-stat"><b>{presence.countries}</b><span>Countries</span></div>
      <div className="vx-global-stat"><b>{presence.traders}</b><span>Traders</span></div>
      <div className="vx-global-regions">
        {presence.regions.map((r) => (
          <div key={r.name} className="vx-global-region">
            <span className="vx-global-flag">{r.flag}</span>
            <b>{r.name}</b>
            <small>{r.hubs.join(" · ")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

// Page scaffold: NavBar + hero (title/lead/eyebrow) + children + horizontal
// social row + Footer. `data` is the /api/company snapshot (or null while loading).
export function CompanyPage({ eyebrow, title, lead, children, showSocial = true }) {
  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          {eyebrow && <span className="vx-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {lead && <p className="vx-muted">{lead}</p>}
        </div>
        {children}
        {showSocial && (
          <div className="vx-social-strip">
            <span className="vx-muted">Follow VoltexAI across the globe:</span>
            <SocialBar />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// Hook: load the shared company snapshot once.
export function useCompany() {
  const [d, setD] = useState(null);
  useEffect(() => { companyService.content().then(setD).catch(() => {}); }, []);
  return d;
}
