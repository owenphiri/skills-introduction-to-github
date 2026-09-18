// src/pages/Support.jsx — help & support hub
import { Link } from "react-router-dom";
import { LegalPage, LSection } from "../components/Legal";

export default function Support() {
  return (
    <LegalPage eyebrow="Help Center" title="Support"
      lead="We’re here to help you get the most out of VoltexAI.">
      <LSection title="Get help fast">
        <ul>
          <li>Browse the <Link to="/faq">FAQ</Link> for instant answers to common questions.</li>
          <li>Learn the platform in <Link to="/academy">Voltex Academy</Link> and the <Link to="/resources">Resources</Link> toolkit.</li>
          <li>Ask the community on the <Link to="/community">Voltex Community</Link> wall.</li>
        </ul>
      </LSection>
      <LSection title="Contact our team">
        <p>
          Email <a href="mailto:support@voltexai.app">support@voltexai.app</a> and our team
          will respond, typically within one business day. For account or billing issues,
          include your account email (never your password).
        </p>
        <p>Prefer to talk to us directly? See the <Link to="/contact">Contact</Link> page for all channels.</p>
      </LSection>
      <LSection title="Common topics">
        <ul>
          <li><b>Account & login</b> — resetting your password, verifying your email.</li>
          <li><b>Billing & plans</b> — upgrades, invoices and <Link to="/pricing">pricing</Link>.</li>
          <li><b>Signals & Scanner</b> — how grades, quality trades and news warnings work.</li>
          <li><b>Auto-trade</b> — paper vs live, the risk layer and the news guard.</li>
          <li><b>Security</b> — protecting your account (see the <Link to="/security">Security Center</Link>).</li>
        </ul>
      </LSection>
      <LSection title="A note on trading help">
        <p className="vx-muted">
          Our team can help with the product, not with trading decisions. VoltexAI does not
          provide personalised financial advice — see the <Link to="/risk-disclosure">Risk
          Disclosure</Link>.
        </p>
      </LSection>
    </LegalPage>
  );
}
