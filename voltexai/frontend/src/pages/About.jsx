// src/pages/About.jsx
import { CompanyPage, useCompany, CardinalPhrases, GlobalStrip } from "../components/Company";

export default function About() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="Our story" title="About VoltexAI"
      lead={d?.mission?.headline}>
      {d && (
        <>
          <div className="vx-mission-band">
            <h2>{d.mission.headline}</h2>
            <p>{d.mission.sub}</p>
          </div>
          <CardinalPhrases phrases={d.phrases} />

          <div className="vx-prose">
            {d.about.story.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <h2 className="vx-section-title">What we stand for</h2>
          <div className="vx-value-grid">
            {d.about.values.map((v) => (
              <div key={v.title} className="vx-value-card">
                <span className="vx-value-icon">{v.icon}</span>
                <b>{v.title}</b><p className="vx-muted">{v.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="vx-section-title">Leadership</h2>
          <div className="vx-lead-grid">
            {d.about.leadership.map((l) => (
              <div key={l.name} className="vx-lead-card">
                <b>{l.name}</b><span className="vx-eyebrow">{l.role}</span>
                <p className="vx-muted">{l.bio}</p>
              </div>
            ))}
          </div>

          <h2 className="vx-section-title">Across the globe</h2>
          <GlobalStrip presence={d.global} />
        </>
      )}
    </CompanyPage>
  );
}
