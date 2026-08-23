// src/pages/Awards.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function Awards() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Recognition" title="🏆 Awards"
      lead="Recognised across Africa and beyond for FinTech, education and applied AI.">
      {d && (
        <div className="vx-award-grid">
          {d.awards.map((a) => (
            <div key={a.id} className="vx-award-card">
              <span className="vx-award-icon">{a.icon}</span>
              <span className="vx-award-year">{a.year}</span>
              <b>{a.title}</b>
              <small className="vx-muted">{a.org}</small>
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
