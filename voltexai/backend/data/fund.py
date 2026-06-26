"""
VoltexAI - Asset-Under-Management (AUM) & investor pitch data
Powers the public "AUM / Managed Programs" page and the investor pitch deck.

IMPORTANT: The performance numbers below are ILLUSTRATIVE program targets and
model/track-record figures for presentation, NOT a solicitation and NOT a
guarantee of returns. Capital is at risk. Any live managed-account program must
be operated under the appropriate licence in each jurisdiction. These figures are
served from a single source so they can be replaced with audited numbers later.
"""
from __future__ import annotations

FUND_OVERVIEW = {
    "program_name": "VoltexAI Managed Alpha",
    "operator": "PrimeAxis ICT Trade & Solutions Ltd",
    "methodology_partner": "Owens Forex Academy (OFA)",
    "inception": "2024-01",
    "base_currency": "USD",
    "aum_usd": 4_250_000,                 # illustrative
    "aum_growth_ytd_pct": 38.4,           # illustrative
    "investors": 312,                     # illustrative
    "countries": 14,
    "strategy": "Multi-strategy discretionary + AI-assisted systematic overlay "
                "(ICT/SMC structure, session liquidity, momentum) across FX, "
                "metals, indices and crypto.",
    "target_net_return_annual_pct": 24.0,
    "target_max_drawdown_pct": 12.0,
    "min_investment_usd": 5_000,
    "min_investment_zmw": 132_500,
    "lockup_months": 3,
    "management_fee_pct": 2.0,
    "performance_fee_pct": 20.0,
    "high_water_mark": True,
    "redemption": "Monthly, 14-day notice",
    "custody": "Segregated managed accounts at regulated brokers (LPOA)",
    "reporting": "Real-time investor dashboard + monthly statements",
}

# Illustrative monthly net returns (%) for the equity-curve chart.
MONTHLY_RETURNS = [
    {"month": "2024-01", "return_pct": 3.1},
    {"month": "2024-02", "return_pct": 2.4},
    {"month": "2024-03", "return_pct": -1.2},
    {"month": "2024-04", "return_pct": 4.0},
    {"month": "2024-05", "return_pct": 1.8},
    {"month": "2024-06", "return_pct": 2.9},
    {"month": "2024-07", "return_pct": -0.6},
    {"month": "2024-08", "return_pct": 3.4},
    {"month": "2024-09", "return_pct": 2.1},
    {"month": "2024-10", "return_pct": 3.8},
    {"month": "2024-11", "return_pct": 1.5},
    {"month": "2024-12", "return_pct": 2.7},
    {"month": "2025-01", "return_pct": 3.3},
    {"month": "2025-02", "return_pct": -1.0},
    {"month": "2025-03", "return_pct": 4.2},
    {"month": "2025-04", "return_pct": 2.0},
    {"month": "2025-05", "return_pct": 2.6},
    {"month": "2025-06", "return_pct": 3.0},
]

ALLOCATION = [
    {"bucket": "FX majors & crosses", "weight_pct": 35},
    {"bucket": "Metals (XAU/XAG)", "weight_pct": 25},
    {"bucket": "Indices (US30/NAS100/SPX)", "weight_pct": 20},
    {"bucket": "Crypto (BTC/ETH)", "weight_pct": 12},
    {"bucket": "Cash buffer", "weight_pct": 8},
]

TIERS = [
    {
        "id": "starter",
        "name": "Starter Mandate",
        "min_usd": 5_000,
        "target_return": "18-22% / yr (target)",
        "split": "70/30 (investor/manager)",
        "perks": ["Segregated managed account", "Monthly reporting",
                  "VoltexAI Trader plan included"],
    },
    {
        "id": "growth",
        "name": "Growth Mandate",
        "min_usd": 25_000,
        "target_return": "22-26% / yr (target)",
        "split": "75/25 (investor/manager)",
        "perks": ["Priority allocation", "Bi-weekly desk calls",
                  "VoltexAI Elite plan included", "Custom risk profile"],
    },
    {
        "id": "private",
        "name": "Private Mandate",
        "min_usd": 100_000,
        "target_return": "Bespoke",
        "split": "80/20 (investor/manager)",
        "perks": ["Dedicated portfolio manager", "Weekly reviews",
                  "Custom strategy blend", "Direct desk line"],
    },
]

# Pitch-deck slides (markdown-ish blocks) consumed by the investor page + export.
PITCH_DECK = [
    {"slide": 1, "title": "VoltexAI",
     "subtitle": "Africa's AI trading terminal & managed-alpha platform",
     "body": "Trade Smart. Trade Safe. Trade Consistently."},
    {"slide": 2, "title": "The problem",
     "body": "African retail traders are underserved: foreign tools price in USD, "
             "ignore mobile-money rails, and bury beginners in complexity. 90% blow "
             "accounts inside 6 months without structure or risk discipline."},
    {"slide": 3, "title": "The solution",
     "body": "An AI trading terminal (Claude-powered) that teaches ICT/SMC, generates "
             "structured signals, scans live markets, and routes payments through "
             "Stripe + Flutterwave (MTN/Airtel/M-Pesa) — built for Africa first."},
    {"slide": 4, "title": "Product",
     "body": "Web + mobile app: AI Terminal, live Markets board, algorithmic Signals "
             "scanner, chart-vision analysis, prop-firm & broker directories, and a "
             "managed-AUM program for hands-off investors."},
    {"slide": 5, "title": "Market",
     "body": "1.4M+ active retail traders across Nigeria, South Africa, Kenya, Ghana "
             "and Zambia; the African online-trading market is growing >20% YoY. "
             "Prop-firm funding has unlocked a new pro-am tier."},
    {"slide": 6, "title": "Business model",
     "body": "SaaS subscriptions ($29 Trader / $99 Elite), AUM management & "
             "performance fees (2/20), prop-firm & broker partner referrals, and an "
             "academy/education tier."},
    {"slide": 7, "title": "Traction (illustrative)",
     "body": "$4.25M AUM · 312 investors · 14 countries · 38% AUM growth YTD · "
             "subscription MRR ramping across three African markets."},
    {"slide": 8, "title": "Why we win",
     "body": "Africa-native payments, OFA methodology + brand trust, Claude-grade AI, "
             "and a flywheel: academy → terminal subscribers → managed-AUM investors."},
    {"slide": 9, "title": "The ask",
     "body": "Raising a seed round to scale licensing, the managed-account desk, and "
             "mobile distribution across West & East Africa."},
]

DISCLAIMER = (
    "Performance figures shown are illustrative program targets and/or model "
    "results, not audited live results, and are not a guarantee of future "
    "performance. Trading leveraged products carries a high risk of loss. VoltexAI "
    "/ PrimeAxis ICT provides technology and educational analysis and does not "
    "provide personalised investment advice. Managed programs are offered only "
    "where lawful and to eligible investors."
)


def fund_summary() -> dict:
    realized = 1.0
    for m in MONTHLY_RETURNS:
        realized *= (1 + m["return_pct"] / 100)
    return {
        "overview": FUND_OVERVIEW,
        "cumulative_return_pct": round((realized - 1) * 100, 1),
        "best_month_pct": max(m["return_pct"] for m in MONTHLY_RETURNS),
        "worst_month_pct": min(m["return_pct"] for m in MONTHLY_RETURNS),
        "positive_months": sum(1 for m in MONTHLY_RETURNS if m["return_pct"] > 0),
        "total_months": len(MONTHLY_RETURNS),
        "tiers": TIERS,
        "allocation": ALLOCATION,
        "disclaimer": DISCLAIMER,
    }
