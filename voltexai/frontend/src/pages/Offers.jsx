// src/pages/Offers.jsx
import { Link } from "react-router-dom";
import { CompanyPage, useCompany } from "../components/Company";

export default function Offers() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Deals" title="🎁 Offers"
      lead="Limited-time deals to get you on the winning team.">
      {d && (
        <div className="vx-offer-grid">
          {d.offers.map((o) => (
            <div key={o.id} className="vx-offer-card" style={{ "--offer-accent": o.accent }}>
              <span className="vx-offer-badge">{o.badge}</span>
              <h3>{o.title}</h3>
              <p className="vx-muted">{o.desc}</p>
              <Link to={o.route} className="vx-btn-primary vx-btn-sm">{o.cta}</Link>
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
