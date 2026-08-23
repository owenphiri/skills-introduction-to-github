// src/components/Footer.jsx — company footer with product map, copyright, CEO
import { Link } from "react-router-dom";
import { SocialBar } from "./Social";

const COLS = [
  { title: "Platform", links: [
    ["Voltex Markets", "/markets"], ["Voltex Signals", "/signals"],
    ["Voltex Scanner", "/scanner"], ["Voltex Vision", "/vision"],
    ["Voltex Terminal", "/terminal"], ["Voltex Trade Desk", "/trade"],
  ]},
  { title: "Grow", links: [
    ["Voltex Academy", "/academy"], ["Voltex Competition", "/competition"],
    ["Voltex Community", "/community"], ["Voltex Resources", "/resources"],
    ["Success Stories", "/success"],
    ["Voltex Prop Intel", "/prop-firms"], ["Voltex Broker Intel", "/brokers"],
  ]},
  { title: "Markets", links: [
    ["Voltex Sentiment", "/sentiment"], ["Voltex Live", "/live"],
    ["Voltex Travel", "/travel"],
  ]},
  { title: "Money", links: [
    ["Voltex Alpha (AUM)", "/aum"], ["Voltex Pay", "/pay"],
    ["Voltex Store", "/store"], ["Pricing", "/pricing"], ["Offers", "/offers"],
  ]},
  { title: "Company", links: [
    ["About Us", "/about"], ["Careers", "/careers"], ["Press", "/press"],
    ["CSR", "/csr"], ["VoltexAI Foundation", "/foundation"], ["Awards", "/awards"],
  ]},
  { title: "Media", links: [
    ["VoltexAI Media", "/media"], ["VoltexAI TV", "/tv"],
    ["Podcast", "/podcast"], ["Blogs", "/blog"],
  ]},
  { title: "Explore", links: [
    ["FAQ", "/faq"], ["Sitemap", "/sitemap"], ["Ecosystem", "/products"],
  ]},
];

export function Footer() {
  return (
    <footer className="vx-site-footer">
      <div className="vx-footer-grid">
        <div className="vx-footer-brand">
          <Link to="/" className="vx-logo">
            <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
          </Link>
          <p className="vx-footer-tag">The operating system for the African trader.</p>
          <p className="vx-footer-motto">Trade Smart · Trade Safe · Trade Consistently</p>
          <SocialBar />
        </div>
        {COLS.map((col) => (
          <div key={col.title} className="vx-footer-col">
            <h4>{col.title}</h4>
            {col.links.map(([label, to]) => (
              <Link key={to} to={to}>{label}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="vx-footer-legal">
        <span>© 2026 VoltexAI Technologies. All rights reserved.</span>
        <span>PrimeAxis ICT Trade &amp; Solutions Ltd · Kasama, Zambia</span>
        <span><b>OP Owens</b> — Founder &amp; CEO · Methodology by Owens Forex Academy</span>
        <span className="vx-footer-risk">
          Trading leveraged products carries a high risk of loss. Educational
          technology, not personalised investment advice.
        </span>
      </div>
    </footer>
  );
}
