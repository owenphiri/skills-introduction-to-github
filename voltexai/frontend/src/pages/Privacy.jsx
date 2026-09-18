// src/pages/Privacy.jsx — privacy policy
import { Link } from "react-router-dom";
import { useBrand } from "../contexts/BrandContext";
import { LegalPage, LSection } from "../components/Legal";

export default function Privacy() {
  const brand = useBrand();
  return (
    <LegalPage title="Privacy Policy" updated="September 2026"
      lead={`How ${brand.name} collects, uses and protects your information.`}>
      <LSection title="1. Who we are">
        <p>{brand.legal || brand.name}{brand.hq ? `, ${brand.hq}` : ""} (“VoltexAI”, “we”, “us”) is the data controller for information processed through this platform.</p>
      </LSection>
      <LSection title="2. Information we collect">
        <ul>
          <li><b>Account data</b> — name, email, country and authentication details.</li>
          <li><b>Usage data</b> — pages viewed, features used, device and log data.</li>
          <li><b>Trading-related inputs</b> — journal entries, watchlists, settings and any results you choose to post.</li>
          <li><b>Payment data</b> — processed by our payment providers; we do not store full card numbers.</li>
        </ul>
      </LSection>
      <LSection title="3. How we use it">
        <ul>
          <li>To provide, secure and improve the platform and your account.</li>
          <li>To process subscriptions, rewards (Voltex Coin) and referrals.</li>
          <li>To communicate service updates and, with consent, marketing you can opt out of.</li>
          <li>To meet legal, tax and compliance obligations.</li>
        </ul>
      </LSection>
      <LSection title="4. Sharing">
        <p>
          We share data only with service providers (hosting, analytics, payment,
          communications) under contract, with brokers/partners you explicitly connect,
          and where required by law. We do not sell your personal data.
        </p>
      </LSection>
      <LSection title="5. Cookies">
        <p>
          We use essential cookies for authentication and preferences, and analytics
          cookies to understand usage. You can control cookies in your browser settings.
        </p>
      </LSection>
      <LSection title="6. Your rights">
        <p>
          Subject to your local law, you may request access, correction, deletion,
          portability, or object to certain processing. Contact <a href="mailto:legal@voltexai.app">legal@voltexai.app</a>.
        </p>
      </LSection>
      <LSection title="7. Security & retention">
        <p>
          We apply technical and organisational safeguards (see the <Link to="/security">Security
          Center</Link>) and retain data only as long as needed for the purposes above or as
          required by law.
        </p>
      </LSection>
      <LSection title="8. Changes">
        <p>We may update this policy; material changes will be notified in-app or by email.</p>
      </LSection>
    </LegalPage>
  );
}
