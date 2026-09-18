// src/pages/Terms.jsx — terms of use
import { Link } from "react-router-dom";
import { useBrand } from "../contexts/BrandContext";
import { LegalPage, LSection, GeneralRiskWarning } from "../components/Legal";

export default function Terms() {
  const brand = useBrand();
  return (
    <LegalPage title="Terms of Use" updated="September 2026"
      lead={`The terms governing your use of ${brand.name}.`}>
      <LSection title="1. Acceptance">
        <p>By accessing or using VoltexAI you agree to these Terms, our <Link to="/privacy">Privacy Policy</Link> and our <Link to="/risk-disclosure">Risk Disclosure</Link>. If you do not agree, do not use the platform.</p>
      </LSection>
      <LSection title="2. Eligibility">
        <p>You must be of legal age in your jurisdiction and legally permitted to use trading-related tools. You are responsible for compliance with your local laws.</p>
      </LSection>
      <LSection title="3. Your account">
        <p>Keep your credentials confidential and enable available security features. You are responsible for all activity under your account. Notify us of any unauthorised use.</p>
      </LSection>
      <LSection title="4. Acceptable use">
        <ul>
          <li>No unlawful, abusive, fraudulent or infringing activity.</li>
          <li>No attempts to disrupt, reverse-engineer, scrape or overload the platform.</li>
          <li>No reselling or redistributing our content, signals or data without permission.</li>
        </ul>
      </LSection>
      <LSection title="5. Subscriptions & payments">
        <p>Paid plans, rewards and refunds are described at <Link to="/pricing">Pricing</Link> and at checkout. Fees are billed in advance and, unless stated otherwise, are non-refundable except where required by law.</p>
      </LSection>
      <LSection title="6. Intellectual property">
        <p>VoltexAI and its software, brand, and content are owned by {brand.legal || brand.name} or its licensors. You receive a limited, non-exclusive, non-transferable licence to use the platform for its intended purpose.</p>
      </LSection>
      <LSection title="7. No advice & trading risk">
        <GeneralRiskWarning />
        <p>VoltexAI provides tools and education only and does not provide personalised financial advice or execute trades except where you explicitly connect a third-party broker. See the full <Link to="/risk-disclosure">Risk Disclosure</Link>.</p>
      </LSection>
      <LSection title="8. Third-party services">
        <p>Brokers, prop firms, payment and data providers are independent third parties governed by their own terms. Partner links may be affiliate links. We are not liable for third-party services.</p>
      </LSection>
      <LSection title="9. Disclaimers & limitation of liability">
        <p>The platform is provided “as is” without warranties of any kind. To the maximum extent permitted by law, VoltexAI is not liable for any trading losses or for indirect, incidental or consequential damages arising from your use of the platform.</p>
      </LSection>
      <LSection title="10. Suspension & changes">
        <p>We may suspend accounts that breach these Terms and may update the platform or these Terms; continued use constitutes acceptance of changes.</p>
      </LSection>
      <LSection title="11. Governing law">
        <p>These Terms are governed by the laws of the jurisdiction in which {brand.legal || brand.name} is established, without regard to conflict-of-law rules.</p>
      </LSection>
      <LSection title="12. Contact">
        <p>Questions? <a href="mailto:legal@voltexai.app">legal@voltexai.app</a> or the <Link to="/contact">Contact</Link> page.</p>
      </LSection>
    </LegalPage>
  );
}
