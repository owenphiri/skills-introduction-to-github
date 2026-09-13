// src/pages/Contact.jsx — contact details & channels
import { Link } from "react-router-dom";
import { useBrand } from "../contexts/BrandContext";
import { LegalPage, LSection } from "../components/Legal";

export default function Contact() {
  const brand = useBrand();
  return (
    <LegalPage eyebrow="Get in touch" title="Contact"
      lead={`Reach the ${brand.name} team — we’d love to hear from you.`}>
      <LSection title="Contact channels">
        <ul>
          <li><b>General & support:</b> <a href="mailto:support@voltexai.app">support@voltexai.app</a></li>
          <li><b>Billing:</b> <a href="mailto:billing@voltexai.app">billing@voltexai.app</a></li>
          <li><b>Partnerships & press:</b> <a href="mailto:partners@voltexai.app">partners@voltexai.app</a></li>
          <li><b>Privacy & legal:</b> <a href="mailto:legal@voltexai.app">legal@voltexai.app</a></li>
          <li><b>Security disclosures:</b> <a href="mailto:security@voltexai.app">security@voltexai.app</a> (see the <Link to="/security">Security Center</Link>)</li>
        </ul>
      </LSection>
      <LSection title="Company">
        <p>
          <b>{brand.legal || brand.name}</b>{brand.hq ? ` · ${brand.hq}` : ""}<br />
          {brand.ceo ? `${brand.ceo} — Founder & CEO` : null}
        </p>
        <p className="vx-muted">
          Phone / WhatsApp and postal address are provided to members in-app and on
          invoices. Please do not send passwords, card numbers or API tokens by email.
        </p>
      </LSection>
      <LSection title="Response times">
        <p>
          We aim to reply to support requests within one business day. Complex billing or
          compliance matters may take longer; we’ll always keep you updated.
        </p>
      </LSection>
    </LegalPage>
  );
}
