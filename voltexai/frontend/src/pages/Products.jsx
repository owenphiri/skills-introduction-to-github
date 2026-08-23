// src/pages/Products.jsx — the Voltex ecosystem hub (the "tech company" showcase)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { ecosystemService } from "../services/ecosystem";

export default function Products() {
  const [data, setData] = useState(null);

  useEffect(() => { ecosystemService.ecosystem().then(setData).catch(() => {}); }, []);

  const company = data?.company;
  const products = data?.products || [];

  return (
    <div className="vx-page">
      <NavBar />
      <main>
        <section className="vx-eco-hero">
          <span className="vx-eyebrow vx-fade-in">VoltexAI Technologies</span>
          <h1 className="vx-fade-in-up">
            One ecosystem. <span className="vx-grad vx-grad-anim">Every edge a trader needs.</span>
          </h1>
          <p className="vx-eco-sub vx-fade-in-up vx-delay-1">
            {company?.tagline || "The operating system for the African trader."} From live
            data and AI signals to education, contests, managed capital and payments —
            all under one roof.
          </p>
          <div className="vx-hero-cta vx-fade-in-up vx-delay-2">
            <Link to="/signup" className="vx-btn-primary vx-btn-lg">Join the movement</Link>
            <Link to="/markets" className="vx-btn-secondary vx-btn-lg">Explore live</Link>
          </div>
        </section>

        <section className="vx-container">
          <div className="vx-eco-grid">
            {products.map((p, i) => (
              <Link key={p.id} to={p.route}
                className="vx-eco-card vx-rise"
                style={{ "--accent": p.accent, animationDelay: `${i * 60}ms` }}>
                <div className="vx-eco-icon" style={{ background: `${p.accent}22`, color: p.accent }}>
                  {p.icon}
                </div>
                <div className="vx-eco-name">{p.name}</div>
                <div className="vx-eco-tag" style={{ color: p.accent }}>{p.tag}</div>
                <p className="vx-eco-blurb">{p.blurb}</p>
                <span className="vx-eco-open">Open →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="vx-eco-stats">
          {[["12", "Products"], ["6", "Markets"], ["14+", "Countries"], ["24/7", "Coverage"]].map(
            ([n, l]) => (
              <div key={l} className="vx-eco-stat">
                <b className="vx-count">{n}</b><span>{l}</span>
              </div>
            ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
