// src/components/Footer.jsx — company footer with product map, copyright, CEO
import { Link } from "react-router-dom";
import { SocialBar } from "./Social";
import { LanguageSelector } from "./LanguageSelector";
import { BrandLogo } from "./BrandLogo";
import { useBrand } from "../contexts/BrandContext";
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
    ["About Us", "/about"], ["Investor Pitch", "/pitch"], ["Careers", "/careers"],
    ["Press", "/press"], ["CSR", "/csr"], ["VoltexAI Foundation", "/foundation"],
    ["Awards", "/awards"],
  ]},
  { title: "Media", links: [
    ["VoltexAI Media", "/media"], ["VoltexAI TV", "/tv"],
    ["Podcast", "/podcast"], ["Blogs", "/blog"],
  ]},
  { title: "Explore", links: [
    ["FAQ", "/faq"], ["Sitemap", "/sitemap"], ["Ecosystem", "/products"],
  ]},
  { title: "Resources", links: [
    ["Support", "/support"], ["Contact", "/contact"],
    ["Privacy policy", "/privacy"], ["Terms of use", "/terms"],
    ["Security center", "/security"], ["Risk disclosure", "/risk-disclosure"],
    ["Sitemap", "/sitemap"],
  ]},
];

export function Footer() {
  const { t } = useI18n();
  const brand = useBrand();
  const isFlagship = brand.slug === "voltexai";
  return (
    <footer className="vx-site-footer">
      <div className="vx-footer-grid">
        <div className="vx-footer-brand">
          <Link to="/" className="vx-logo"><BrandLogo /></Link>
          <p className="vx-footer-tag">{isFlagship ? t("footer.tag") : brand.tagline}</p>
          <p className="vx-footer-motto">{isFlagship ? t("footer.motto") : brand.motto}</p>
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
        <span>© 2026 {brand.name}{brand.established ? ` · ${brand.established}` : ""} · {t("footer.rights")}</span>
        {(brand.legal || brand.hq) && (
          <span>{t("footer.poweredBy")} <b>{brand.legal || brand.name}</b>{brand.hq ? ` · ${brand.hq}` : ""}</span>
        )}
        {brand.ceo && (
          <span><b>{brand.ceo}</b> — {t("footer.founderCeo")}{isFlagship ? " · Methodology by Owens Forex Academy" : ""}</span>
        )}
        <span className="vx-footer-risk">{t("footer.risk")}</span>
        <span className="vx-footer-risk">
          Trading FX, CFDs, futures, synthetic indices &amp; crypto is high-risk and may
          not suit all investors; you can lose more than you invest. VoltexAI provides
          technology &amp; education only — not financial advice. Hypothetical/simulated
          results have inherent limitations (CFTC Rule 4.41). See the full{" "}
          <Link to="/risk-disclosure">Risk Disclosure &amp; CFTC notices</Link>.
        </span>
      </div>
    </footer>
  );
}
