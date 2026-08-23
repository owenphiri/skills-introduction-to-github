// src/pages/CSR.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function CSR() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Corporate Social Responsibility" title="🤝 Trading up the community"
      lead={d?.csr?.headline}>
      {d && (
        <div className="vx-card-grid">
          {d.csr.programs.map((p) => (
            <div key={p.title} className="vx-icon-card">
              <span className="vx-value-icon">{p.icon}</span>
              <b>{p.title}</b><p className="vx-muted">{p.desc}</p>
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
