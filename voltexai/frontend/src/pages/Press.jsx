// src/pages/Press.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function Press() {
  const d = useCompany();
  const p = d?.press;
  return (
    <CompanyPage eyebrow="Newsroom" title="📰 Press"
      lead="The latest from VoltexAI Technologies.">
      {p && (
        <>
          <p className="vx-muted">Media enquiries: <a className="vx-link" href={`mailto:${p.contact}`}>{p.contact}</a></p>
          <h2 className="vx-section-title">Press releases</h2>
          <div className="vx-press-list">
            {p.releases.map((r) => (
              <div key={r.id} className="vx-press-row">
                <div className="vx-press-meta"><span className="vx-chip">{r.tag}</span><small>{r.date}</small></div>
                <b>{r.title}</b>
                <p className="vx-muted">{r.summary}</p>
              </div>
            ))}
          </div>
          <h2 className="vx-section-title">In the media</h2>
          <div className="vx-card-grid">
            {p.mentions.map((m) => (
              <div key={m.outlet} className="vx-quote-card">
                <p>“{m.quote}”</p><b>— {m.outlet}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </CompanyPage>
  );
}
