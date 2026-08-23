// src/components/Testimonials.jsx — reusable testimonials grid
import { useEffect, useState } from "react";
import { socialService } from "../services/social";

export function Testimonials({ limit }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    socialService.testimonials()
      .then((d) => setItems(limit ? d.testimonials.slice(0, limit) : d.testimonials))
      .catch(() => {});
  }, [limit]);

  if (!items.length) return null;
  return (
    <div className="vx-testi-grid">
      {items.map((t, i) => (
        <figure key={i} className="vx-testi-card vx-rise" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="vx-testi-stars">{"★".repeat(t.rating)}</div>
          <blockquote>“{t.quote}”</blockquote>
          <figcaption>
            <span className="vx-testi-avatar">{t.avatar}</span>
            <span>
              <b>{t.name}</b>
              <small>{t.role} · {t.country}</small>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
