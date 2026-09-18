// src/components/Legal.jsx — shared scaffold + reusable risk/CFTC disclosure blocks
import { CompanyPage } from "./Company";

export function LegalPage({ eyebrow = "Legal & Compliance", title, updated, lead, children }) {
  return (
    <CompanyPage eyebrow={eyebrow} title={title} lead={lead} showSocial={false}>
      {updated && <p className="vx-legal-updated">Last updated: {updated}</p>}
      <div className="vx-legal">{children}</div>
    </CompanyPage>
  );
}

export function LSection({ id, title, children }) {
  return (
    <section className="vx-legal-section" id={id}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

// ---- Reusable risk / CFTC disclosure blocks (used on Risk page + footers) ----
export function GeneralRiskWarning() {
  return (
    <p>
      Trading foreign exchange, contracts for difference (CFDs), futures, synthetic
      indices, commodities, indices, stocks and cryptocurrencies carries a high level
      of risk to your capital and may not be suitable for all investors. Leverage can
      work against you as well as for you. Before deciding to trade you should carefully
      consider your objectives, financial situation, needs and level of experience. You
      could sustain a loss of some or all of your initial investment and should not
      invest money you cannot afford to lose. <b>Past performance is not indicative of
      future results.</b>
    </p>
  );
}

export function NoAdviceDisclaimer() {
  return (
    <p>
      VoltexAI provides technology, education, analytics and informational tools only.
      Nothing on this platform constitutes financial, investment, legal or tax advice,
      nor a recommendation, solicitation or offer to buy or sell any financial
      instrument. Signals, scanner outputs, top-down analysis, AI narration and
      automated tools are provided for educational and informational purposes and are
      not guarantees of any outcome. All trading decisions are your own — consult a
      licensed professional before trading.
    </p>
  );
}

export function CftcHypothetical() {
  return (
    <div className="vx-legal-callout">
      <b>Hypothetical Performance Disclosure — CFTC Rule 4.41</b>
      <p>
        Hypothetical or simulated performance results have certain inherent limitations.
        Unlike an actual performance record, simulated results do not represent actual
        trading. Also, because the trades have not actually been executed, the results
        may have under- or over-compensated for the impact, if any, of certain market
        factors such as lack of liquidity. Simulated trading programs in general are
        also subject to the fact that they are designed with the benefit of hindsight.
        No representation is being made that any account will or is likely to achieve
        profit or losses similar to those shown.
      </p>
    </div>
  );
}

export function CftcGovRequired() {
  return (
    <div className="vx-legal-callout">
      <b>U.S. Government Required Disclaimer — Commodity Futures Trading Commission</b>
      <p>
        Futures, foreign currency and options trading have large potential rewards, but
        also large potential risk. You must be aware of the risks and be willing to
        accept them in order to invest in these markets. Do not trade with money you
        cannot afford to lose. This is neither a solicitation nor an offer to buy or
        sell futures, spot foreign exchange, CFDs, options or other financial products.
        No representation is being made that any account will or is likely to achieve
        profits or losses similar to those discussed on this platform. The past
        performance of any trading system or methodology is not necessarily indicative
        of future results.
      </p>
    </div>
  );
}

export function AutomationRisk() {
  return (
    <p>
      Automated and algorithmic trading — including Expert Advisors (EAs), the Voltex
      auto-executor, quantitative systems and any copy features — carries additional
      risks such as technical failure, connectivity loss, latency, and rapid or
      cascading losses. Paper and demo results do not reflect real trading conditions,
      spreads, slippage or execution. Any live trading is enabled and entered entirely
      at your own risk, and you remain responsible for every order placed on your
      account.
    </p>
  );
}

export function ResultsDisclaimer() {
  return (
    <p>
      Client results, testimonials and “verified wins” shown on VoltexAI are individual
      experiences and are not representative of all users. They are not a promise or
      guarantee of future performance, and your results may differ materially. Trading
      involves risk of loss.
    </p>
  );
}
