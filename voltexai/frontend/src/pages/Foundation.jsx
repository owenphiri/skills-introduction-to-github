// src/pages/Foundation.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function Foundation() {
  const d = useCompany();
  const f = d?.foundation;
  return (
    <CompanyPage eyebrow={f?.name || "VoltexAI Foundation"} title="🌍 VoltexAI Foundation"
      lead={f?.mission}>
      {f && (
        <>
          <div className="vx-mission-band">
            <h2>Financial Freedom — Bridging the Gap.</h2>
            <p>{f.mission}</p>
          </div>
          <div className="vx-highlight-row">
            {f.impact.map((i) => (
              <div key={i.label} className="vx-highlight"><b>{i.value}</b><span>{i.label}</span></div>
            ))}
          </div>
          <h2 className="vx-section-title">Our pillars</h2>
          <div className="vx-card-grid">
            {f.pillars.map((p) => (
              <div key={p.title} className="vx-icon-card">
                <span className="vx-value-icon">{p.icon}</span>
                <b>{p.title}</b><p className="vx-muted">{p.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </CompanyPage>
  );
}
