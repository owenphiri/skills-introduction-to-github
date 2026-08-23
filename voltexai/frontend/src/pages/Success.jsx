// src/pages/Success.jsx — Success Stories & Testimonies (traffic-driving CTAs)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { Testimonials } from "../components/Testimonials";
import { socialService } from "../services/social";

export default function Success() {
  const [stats, setStats] = useState([]);
  useEffect(() => { socialService.testimonials().then((d) => setStats(d.stats)).catch(() => {}); }, []);

  return (
    <div className="vx-page">
      <NavBar />
      <main>
        <section className="vx-success-hero">
          <span className="vx-eyebrow vx-fade-in">Success Stories · From across the globe</span>
          <h1 className="vx-fade-in-up">
            Real traders. <span className="vx-grad vx-grad-anim">Real progress.</span>
          </h1>
          <p className="vx-success-sub vx-fade-in-up vx-delay-1">
            From Lusaka to London, traders are leveling up with VoltexAI — passing prop
            challenges, winning contests, and finally trading with a real edge.
          </p>
          <div className="vx-hero-cta vx-fade-in-up vx-delay-2">
            <Link to="/signup" className="vx-btn-primary vx-btn-lg">Start your story — free</Link>
            <Link to="/competition" className="vx-btn-secondary vx-btn-lg">Enter a contest</Link>
          </div>
          <div className="vx-eco-stats">
            {stats.map((s) => (
              <div key={s.label} className="vx-eco-stat">
                <b className="vx-count">{s.value}</b><span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="vx-container">
          <h2 className="vx-section-title">What traders are saying</h2>
          <Testimonials />
        </section>

        <section className="vx-cta-band">
          <h2>Your success story starts today.</h2>
          <p>Free plan · no card · trade risk-free on a paper account from minute one.</p>
          <div className="vx-hero-cta">
            <Link to="/signup" className="vx-btn-primary vx-btn-lg">Join the winning team ⚡</Link>
            <Link to="/academy" className="vx-btn-ghost vx-btn-lg">Explore the Academy</Link>
          </div>
        </section>
        <p className="vx-container vx-fineprint">
          Stories reflect individual experiences and are not a guarantee of results.
          Trading carries a high risk of loss.
        </p>
      </main>
      <Footer />
    </div>
  );
}
