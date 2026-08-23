// src/pages/TV.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function TV() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="VoltexAI Media" title="📺 VoltexAI TV"
      lead="Live shows, market breakdowns and masterclasses with the desk.">
      {d && (
        <div className="vx-card-grid">
          {d.tv.map((s) => (
            <div key={s.id} className="vx-show-card">
              <div className="vx-show-thumb">{s.thumb}</div>
              <b>{s.title}</b>
              <span className="vx-eyebrow">{s.schedule}</span>
              <p className="vx-muted">{s.desc}</p>
              <small className="vx-muted">Host: {s.host}</small>
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
