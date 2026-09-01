"""
VoltexAI Real Estate — curated property-investment vertical.

Editorial/marketing reference data for the Real Estate landing page: headline
stats, fractional-investment opportunities across African and global markets, and
a simple "how it works" flow. Illustrative only — not a solicitation or an offer
of securities; property investment carries risk and values can fall as well as rise.
"""
from __future__ import annotations

LAUNCH = {
    "status": "coming_soon",
    "label": "Coming soon",
    "headline": "Launching after our MOUs are signed",
    "note": ("Fractional property investment goes live once VoltexAI finalises "
             "Memoranda of Understanding with property partners, developers and the "
             "relevant regulators. Join the waitlist and you'll be first to invest — "
             "settled through VoltexAI Pay."),
}

OVERVIEW = {
    "name": "VoltexAI Real Estate",
    "tagline": "Turn trading gains into brick-and-mortar wealth.",
    "launch": LAUNCH,
    "blurb": ("Diversify beyond the charts. Co-invest in vetted, income-producing "
              "property across Africa and beyond — from as little as $50, funded by "
              "card or mobile money, with rental yield paid to your VoltexAI wallet."),
    "stats": [
        {"label": "Avg. target yield", "value": "11.4%", "note": "net rental, p.a."},
        {"label": "Min. investment", "value": "$50", "note": "fractional shares"},
        {"label": "Markets", "value": "9", "note": "cities & counting"},
        {"label": "Property value listed", "value": "$14.2M", "note": "across live deals"},
    ],
    "why": [
        {"icon": "🧱", "title": "Fractional ownership",
         "body": "Own a slice of premium property without the full price tag. Buy shares, "
                 "earn your share of the rent, sell when you choose."},
        {"icon": "📈", "title": "Real diversification",
         "body": "Uncorrelated to forex and crypto. Balance the volatility of trading with "
                 "steady, inflation-resistant real assets."},
        {"icon": "📱", "title": "Mobile-money native",
         "body": "Fund with MTN MoMo, Airtel, M-Pesa or card — the same rails as the rest of "
                 "VoltexAI. No banks, no borders."},
        {"icon": "🪙", "title": "Paid to your wallet",
         "body": "Rental income and exit proceeds settle to your VoltexAI balance — reinvest, "
                 "withdraw, or roll into your next trade."},
    ],
    "steps": [
        ["Browse vetted deals", "Every listing is screened for title, yield and demand before it goes live."],
        ["Invest from $50", "Buy fractional shares in one tap — card or mobile money."],
        ["Earn rental yield", "Your share of net rent is paid to your VoltexAI wallet each period."],
        ["Exit on your terms", "Sell your shares on the marketplace or hold to the deal's maturity."],
    ],
}

# accent-tinted "photo" gradients keep the page brand-consistent without stock imagery
PROPERTIES = [
    {"id": "kasama-heights", "name": "Kasama Heights Apartments", "city": "Kasama", "country": "Zambia",
     "flag": "🇿🇲", "type": "Residential · 24 units", "price_usd": 480000, "min_invest_usd": 50,
     "yield_pct": 12.8, "funded_pct": 74, "term_months": 36, "accent": "#c2f53d",
     "tagline": "Flagship build in VoltexAI's home city — high rental demand from the university district."},
    {"id": "lagos-lekki", "name": "Lekki Waterfront Residences", "city": "Lagos", "country": "Nigeria",
     "flag": "🇳🇬", "type": "Residential · 40 units", "price_usd": 2100000, "min_invest_usd": 100,
     "yield_pct": 10.5, "funded_pct": 58, "term_months": 48, "accent": "#4d7cff",
     "tagline": "Premium serviced apartments on the Lekki peninsula — dollar-indexed rents."},
    {"id": "nairobi-westlands", "name": "Westlands Grade-A Offices", "city": "Nairobi", "country": "Kenya",
     "flag": "🇰🇪", "type": "Commercial · office", "price_usd": 3400000, "min_invest_usd": 250,
     "yield_pct": 9.2, "funded_pct": 41, "term_months": 60, "accent": "#45e0a0",
     "tagline": "Anchor-tenanted offices in Nairobi's business hub with long WALE leases."},
    {"id": "accra-cantonments", "name": "Cantonments Townhomes", "city": "Accra", "country": "Ghana",
     "flag": "🇬🇭", "type": "Residential · 12 units", "price_usd": 890000, "min_invest_usd": 75,
     "yield_pct": 11.6, "funded_pct": 88, "term_months": 36, "accent": "#ffb547",
     "tagline": "Gated townhomes in a diplomatic enclave — expat rental market."},
    {"id": "capetown-seapoint", "name": "Sea Point Holiday Lets", "city": "Cape Town", "country": "South Africa",
     "flag": "🇿🇦", "type": "Short-let · 8 units", "price_usd": 1250000, "min_invest_usd": 100,
     "yield_pct": 13.9, "funded_pct": 63, "term_months": 24, "accent": "#a06bff",
     "tagline": "Atlantic-seaboard short-stay apartments — peak-season nightly rates."},
    {"id": "dubai-jvc", "name": "JVC Smart Studios", "city": "Dubai", "country": "UAE",
     "flag": "🇦🇪", "type": "Residential · 30 units", "price_usd": 4600000, "min_invest_usd": 300,
     "yield_pct": 8.6, "funded_pct": 35, "term_months": 60, "accent": "#4dd0e1",
     "tagline": "Tax-free rental income in a globally liquid, dollar-pegged market."},
]


def list_properties(market: str | None = None) -> list[dict]:
    if market and market != "all":
        return [p for p in PROPERTIES if p["country"].lower() == market.lower()]
    return PROPERTIES


def get_property(pid: str) -> dict | None:
    return next((p for p in PROPERTIES if p["id"] == pid), None)


def realestate_overview() -> dict:
    return {**OVERVIEW, "properties": PROPERTIES,
            "markets": sorted({p["country"] for p in PROPERTIES})}
