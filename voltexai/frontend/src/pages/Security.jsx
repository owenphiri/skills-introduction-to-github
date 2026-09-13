// src/pages/Security.jsx — security center
import { LegalPage, LSection } from "../components/Legal";

export default function Security() {
  return (
    <LegalPage eyebrow="Security Center" title="Security"
      updated="September 2026"
      lead="How we protect your account and data — and how you can help.">
      <LSection title="How we protect you">
        <ul>
          <li><b>Encryption</b> — traffic is served over HTTPS/TLS; sensitive data is encrypted in transit.</li>
          <li><b>Authentication</b> — hashed passwords, session tokens, and refresh-token rotation.</li>
          <li><b>Least privilege</b> — access to systems and data is restricted and monitored.</li>
          <li><b>Payments</b> — handled by PCI-compliant providers; we don’t store full card numbers.</li>
          <li><b>Secrets</b> — broker/API tokens are injected server-side and never exposed to the browser or to our AI models.</li>
        </ul>
      </LSection>
      <LSection title="How you can help">
        <ul>
          <li>Use a strong, unique password and never share it.</li>
          <li>Beware of phishing — we will never ask for your password or full card number by email.</li>
          <li>For broker connections, use <b>demo/read-only API tokens</b> first; enable live access only when you fully understand the risk.</li>
          <li>Log out on shared devices and keep your email account secure.</li>
        </ul>
      </LSection>
      <LSection title="Responsible disclosure">
        <p>
          Found a vulnerability? We appreciate coordinated disclosure. Email
          <a href="mailto:security@voltexai.app"> security@voltexai.app</a> with details and
          steps to reproduce. Please do not access other users’ data, degrade the service,
          or disclose the issue publicly until we’ve had a reasonable chance to fix it.
          We will acknowledge your report and keep you informed.
        </p>
      </LSection>
      <LSection title="No guarantees">
        <p className="vx-muted">
          No online service can be 100% secure. We work hard to protect your data but
          cannot guarantee absolute security; you use the platform at your own risk and
          are responsible for safeguarding your credentials and broker connections.
        </p>
      </LSection>
    </LegalPage>
  );
}
