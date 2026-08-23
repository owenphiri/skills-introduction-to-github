// src/pages/Blog.jsx
import { CompanyPage, useCompany } from "../components/Company";

export default function Blog() {
  const d = useCompany();
  return (
    <CompanyPage eyebrow="VoltexAI Media" title="📝 Blogs"
      lead="Research, education and product notes from the VoltexAI team.">
      {d && (
        <div className="vx-blog-grid">
          {d.blog.map((b) => (
            <article key={b.id} className="vx-blog-card">
              <span className="vx-chip">{b.tag}</span>
              <h3>{b.title}</h3>
              <p className="vx-muted">{b.excerpt}</p>
              <div className="vx-blog-foot">
                <small className="vx-muted">{b.author}</small>
                <small className="vx-muted">{b.date} · {b.read_min} min read</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </CompanyPage>
  );
}
