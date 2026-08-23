// src/pages/Media.jsx
import { Link } from "react-router-dom";
import { CompanyPage, useCompany } from "../components/Company";

export default function Media() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="VoltexAI Media — FinTech" title="🎬 VoltexAI Media"
      lead={d?.media?.tagline}>
      {d && (
        <div className="vx-card-grid">
          {d.media.verticals.map((v) => (
            <Link key={v.title} to={v.route} className="vx-icon-card vx-icon-card--link">
              <span className="vx-value-icon">{v.icon}</span>
              <b>{v.title}</b><p className="vx-muted">{v.desc}</p>
              <span className="vx-link">Explore →</span>
            </Link>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
