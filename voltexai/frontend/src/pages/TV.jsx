// src/pages/TV.jsx — VoltexAI TV with live YouTube integration + marquees
import { CompanyPage, useCompany } from "../components/Company";
import { VMarquee } from "../components/VMarquee";
import { Reveal } from "../components/Reveal";

function YouTubePlayer({ yt }) {
  // Prefer a specific featured video; else the channel's live stream; else a CTA.
  const src = yt.live_video_id
    ? `https://www.youtube.com/embed/${yt.live_video_id}?rel=0`
    : yt.channel_id
      ? `https://www.youtube.com/embed/live_stream?channel=${yt.channel_id}&autoplay=0`
      : null;

  if (!src) {
    return (
      <div className="vx-yt-cta">
        <div className="vx-yt-cta-inner">
          <span className="vx-yt-logo">▶</span>
          <div>
            <b>VoltexAI TV is on YouTube</b>
            <p className="vx-muted">Live market opens, killzone sessions and masterclasses. Subscribe to catch every stream.</p>
          </div>
        </div>
        <a className="vx-btn-primary" href={yt.subscribe_url} target="_blank" rel="noopener noreferrer">
          Subscribe on YouTube
        </a>
      </div>
    );
  }
  return (
    <div className="vx-yt-frame">
      <iframe src={src} title="VoltexAI TV live" frameBorder="0" allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
    </div>
  );
}

export default function TV() {
  const d = useCompany();
  const yt = d?.youtube;

  return (
    <CompanyPage eyebrow="VoltexAI Media" title="📺 VoltexAI TV"
      lead="Live shows, market breakdowns and masterclasses — streaming on YouTube.">
      {d && (
        <>
          <div className="vx-tv-live-row">
            <Reveal className="vx-tv-player-wrap">
              <div className="vx-tv-live-head">
                <span className="vx-live-badge">● LIVE / LATEST</span>
                <a className="vx-link" href={yt.channel_url} target="_blank" rel="noopener noreferrer">
                  {yt.channel_handle} on YouTube ↗
                </a>
              </div>
              <YouTubePlayer yt={yt} />
              <div className="vx-tv-actions">
                <a className="vx-btn-primary vx-btn-sm" href={yt.subscribe_url} target="_blank" rel="noopener noreferrer">▶ Subscribe</a>
                <a className="vx-btn-ghost vx-btn-sm" href={yt.channel_url} target="_blank" rel="noopener noreferrer">Visit channel</a>
              </div>
            </Reveal>

            {/* Dual vertical marquees: schedule scrolls down, featured scrolls up */}
            <div className="vx-marquee-col vx-tv-marquees">
              <VMarquee title="🗓️ On air this week" dir="down" items={d.tv}
                render={(s) => (
                  <div className="vx-tv-marq-item">
                    <b>{s.thumb} {s.title}</b><span className="vx-muted">{s.schedule}</span>
                  </div>
                )} />
              <VMarquee title="⭐ Featured episodes" dir="up" items={yt.featured}
                render={(f) => (
                  <a className="vx-tv-marq-item link"
                     href={f.video_id ? `https://www.youtube.com/watch?v=${f.video_id}` : yt.channel_url}
                     target="_blank" rel="noopener noreferrer">
                    <b>{f.thumb} {f.title}</b><span className="vx-link">Watch ↗</span>
                  </a>
                )} />
            </div>
          </div>

          <h2 className="vx-section-title">Shows</h2>
          <div className="vx-card-grid">
            {d.tv.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <div className="vx-show-card vx-hover-lift">
                  <div className="vx-show-thumb">{s.thumb}</div>
                  <b>{s.title}</b>
                  <span className="vx-eyebrow">{s.schedule}</span>
                  <p className="vx-muted">{s.desc}</p>
                  <small className="vx-muted">Host: {s.host}</small>
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </CompanyPage>
  );
}
