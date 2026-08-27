// src/components/Footer.jsx — company footer with product map, copyright, CEO
import { Link } from "react-router-dom";
import { SocialBar } from "./Social";
import { LanguageSelector } from "./LanguageSelector";
import { useI18n } from "../i18n";

const COLS = [
  { title: "Platform", links: [
    ["Voltex Markets", "/markets"], ["Voltex Signals", "/signals"],
    ["Signals Pro (VIP)", "/pro-signals"],
    ["Voltex Scanner", "/scanner"], ["Voltex Vision", "/vision"],
    ["Voltex Terminal", "/terminal"], ["Voltex Trade Desk", "/trade"],
    ["Trade Journal", "/journal"], ["Command Center", "/dashboard"],
  ]},
  { title: "Grow", links: [
    ["Voltex Academy", "/academy"], ["Voltex Competition", "/competition"],
    ["EA Fleet", "/eas"], ["Calculators", "/calculators"],
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
    ["Refer & Earn", "/referrals"],
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
  const { t } = useI18n();
  return (
    <footer className="vx-site-footer">
      <div className="vx-footer-grid">
        <div className="vx-footer-brand">
          <Link to="/" className="vx-logo">
            <span className="vx-logo-mark">⚡</span> Voltex<span className="vx-logo-ai">AI</span>
          </Link>
          <p className="vx-footer-tag">{t("footer.tag")}</p>
          <p className="vx-footer-motto">{t("footer.motto")}</p>
          <SocialBar />
          <div className="vx-footer-lang"><LanguageSelector /></div>
        </div>
        {COLS.map((col) => (
          <div key={col.title} className="vx-footer-col">
            <h4>{t(`col.${col.title}`)}</h4>
            {col.links.map(([label, to]) => (
              <Link key={to} to={to}>{label}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="vx-footer-legal">
        <span>© 2026 VoltexAI Technologies · EST. 2017 · {t("footer.rights")}</span>
        <span>{t("footer.poweredBy")} <b>Axion Labs Technologies</b> · Kasama, Zambia</span>
        <span><b>OP OWENS PHIRI</b> — {t("footer.founderCeo")} · Methodology by Owens Forex Academy</span>
        <span className="vx-footer-risk">{t("footer.risk")}</span>
      </div>
    </footer>
  );
}
