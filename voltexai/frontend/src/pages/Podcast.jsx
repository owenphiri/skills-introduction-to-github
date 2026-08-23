// src/pages/Podcast.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function Podcast() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="VoltexAI Media" title="🎙️ VoltexAI Podcast"
      lead="Conversations with traders, builders and the people bridging the gap.">
      {d && (
        <div className="vx-episode-list">
          {d.podcast.map((e) => (
            <div key={e.id} className="vx-episode-row">
              <div className="vx-episode-num">#{e.ep}</div>
              <div className="vx-episode-main">
                <b>{e.title}</b>
                <p className="vx-muted">{e.desc}</p>
                <small className="vx-muted">Guest: {e.guest} · {e.date}</small>
              </div>
              <div className="vx-episode-side">
                <span className="vx-chip">{e.duration}</span>
                <button className="vx-btn-ghost vx-btn-sm" disabled>▶ Play</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
