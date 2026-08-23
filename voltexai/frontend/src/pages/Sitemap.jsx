// src/pages/Sitemap.jsx
import { Link } from "react-router-dom";
import { CompanyPage, useCompany } from "../components/Company";

export default function Sitemap() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Navigation" title="🗺️ Sitemap"
      lead="Every corner of VoltexAI, in one place.">
      {d && (
        <div className="vx-sitemap-grid">
          {d.sitemap.map((grp) => (
            <div key={grp.section} className="vx-sitemap-col">
              <h3>{grp.section}</h3>
              {grp.links.map(([to, label]) => (
                <Link key={to} to={to}>{label}</Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
