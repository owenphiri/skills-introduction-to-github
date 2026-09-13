// src/pages/RiskDisclosure.jsx — full risk disclosure incl. CFTC rules
import { LegalPage, LSection, GeneralRiskWarning, NoAdviceDisclaimer,
  CftcHypothetical, CftcGovRequired, AutomationRisk, ResultsDisclaimer } from "../components/Legal";

export default function RiskDisclosure() {
  return (
    <LegalPage title="Risk Disclosure & CFTC Notices" updated="September 2026"
      lead="Please read this notice carefully before using VoltexAI or making any trading decision.">
      <LSection title="1. General risk warning">
        <GeneralRiskWarning />
      </LSection>

      <LSection title="2. No investment advice">
        <NoAdviceDisclaimer />
      </LSection>

      <LSection title="3. Hypothetical & simulated performance (CFTC Rule 4.41)">
        <p>
          VoltexAI includes back-tested strategies, a paper-trading auto-executor, demo
          accounts and educational examples. Where any performance is hypothetical or
          simulated, the following applies:
        </p>
        <CftcHypothetical />
      </LSection>

      <LSection title="4. U.S. Government required disclaimer">
        <CftcGovRequired />
        <p className="vx-muted">
          VoltexAI is a technology and education provider and is not a registered broker,
          futures commission merchant, or investment adviser. The CFTC notices above are
          provided for users in jurisdictions where they apply; users elsewhere remain
          subject to their own local laws and their broker’s risk disclosures.
        </p>
      </LSection>

      <LSection title="5. Automated & algorithmic trading">
        <AutomationRisk />
      </LSection>

      <LSection title="6. Leverage, CFDs & synthetic indices">
        <p>
          Leveraged products can move rapidly and you may lose more than you deposit with
          some brokers. Synthetic indices and cryptocurrencies can be extremely volatile
          and trade outside standard market hours. High-impact news events (e.g. NFP,
          CPI, FOMC) can cause sudden gaps, widened spreads and slippage — VoltexAI’s
          news guard and warnings are risk aids, not protections against loss.
        </p>
      </LSection>

      <LSection title="7. Third-party brokers & partners">
        <p>
          VoltexAI does not hold client funds and does not execute trades on your behalf
          except where you explicitly connect and authorise a third-party broker (e.g.
          Deriv) at your own risk. Broker and prop-firm links marked “✦ Partner” are
          affiliate links; VoltexAI may earn a commission at no extra cost to you. This
          never affects our editorial listings or your pricing.
        </p>
      </LSection>

      <LSection title="8. Client results & testimonials">
        <ResultsDisclaimer />
      </LSection>

      <LSection title="9. Acknowledgement">
        <p>
          By using VoltexAI you acknowledge that you have read and understood this Risk
          Disclosure, that trading is speculative and carries a substantial risk of loss,
          and that you accept full responsibility for your own trading decisions.
        </p>
      </LSection>
    </LegalPage>
  );
}
