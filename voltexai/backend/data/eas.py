"""
Voltex EA Fleet — the catalog of VoltexAI Expert Advisors (trading robots),
ordered most-advanced first. Flagship models are self-optimizing (reinforcement
learning); every EA ships the full advanced-indicator stack inside. Editorial /
product data — performance figures are illustrative, not a promise of profit.
"""
from __future__ import annotations

SLOGANS = ["Every day a payday.", "Roadmap to Billionaires.",
           "Best-quality setups in the industry.", "Trade Smart · Trade Safe · Trade Consistently."]

# The advanced indicator stack bundled inside every Voltex EA.
INDICATORS = [
    "Market-structure & BOS/CHoCH", "Order blocks & Fair Value Gaps",
    "Liquidity sweeps & stop hunts", "Multi-timeframe trend engine",
    "Volatility (ATR) adaptive stops", "Session & killzone filters",
    "News/high-impact event filter", "Volume & delta confirmation",
    "Fibonacci OTE zones", "Smart risk & drawdown guard",
]

# Ordered most-advanced first.
FLEET = [
    {
        "id": "rl-alpha", "name": "RL Alpha", "tier": "Flagship",
        "tagline": "Self-optimizing reinforcement-learning core that hunts the best setups, 24/7.",
        "desc": "Our flagship. A reinforcement-learning engine that continuously "
                "re-optimizes its own parameters to market regime — surfacing only "
                "the highest-quality, highest-confluence setups in the industry.",
        "markets": ["Forex", "Gold", "Indices", "Crypto"], "timeframe": "M5–H4",
        "strategy": "Reinforcement learning + SMC confluence",
        "self_optimizing": True, "status": "Live", "accent": "#c2f53d",
        "highlights": ["Self-optimizing RL core", "Regime-adaptive risk",
                       "Only A+ setups", "Auto position sizing"],
    },
    {
        "id": "gold-hydra", "name": "Gold Hydra", "tier": "Flagship",
        "tagline": "Multi-headed gold specialist — several strategies, one risk brain.",
        "desc": "A multi-strategy XAUUSD powerhouse: breakout, mean-reversion and "
                "liquidity-sweep heads run in parallel under a single adaptive risk "
                "manager tuned for gold's volatility.",
        "markets": ["Gold (XAUUSD)"], "timeframe": "M1–H1",
        "strategy": "Multi-strategy ensemble + liquidity model",
        "self_optimizing": True, "status": "Live", "accent": "#ffb547",
        "highlights": ["3 strategy heads", "Gold-tuned volatility model",
                       "News-aware", "Prop-firm safe limits"],
    },
    {
        "id": "index-reaper", "name": "Index Reaper", "tier": "Advanced",
        "tagline": "NAS100 & US30 killzone sniper.",
        "desc": "Trades the New York index killzones with order-block and FVG entries, "
                "built for NAS100, US30 and SPX500.",
        "markets": ["Indices"], "timeframe": "M5–M30",
        "strategy": "ICT killzone + order blocks",
        "self_optimizing": False, "status": "Live", "accent": "#4d7cff",
        "highlights": ["NY killzone timing", "OB/FVG entries", "Dynamic trailing"],
    },
    {
        "id": "fx-sniper", "name": "FX Sniper", "tier": "Advanced",
        "tagline": "Precision forex-majors entries with tight risk.",
        "desc": "Single-shot, high-confluence entries on the FX majors with strict "
                "1-per-setup discipline and ATR-adaptive stops.",
        "markets": ["Forex majors"], "timeframe": "M15–H4",
        "strategy": "Confluence sniper + MTF trend",
        "self_optimizing": False, "status": "Live", "accent": "#45e0a0",
        "highlights": ["High-confluence only", "ATR stops", "MTF trend filter"],
    },
    {
        "id": "session-surge", "name": "Session Surge", "tier": "Pro",
        "tagline": "Rides London & New York opens.",
        "desc": "Momentum breakouts around the London and New York session opens with "
                "a volatility-expansion filter.",
        "markets": ["Forex", "Indices"], "timeframe": "M5–M15",
        "strategy": "Session breakout + volatility expansion",
        "self_optimizing": False, "status": "Live", "accent": "#a06bff",
        "highlights": ["Session timing", "Breakout filter", "Spread guard"],
    },
    {
        "id": "grid-guardian", "name": "Grid Guardian", "tier": "Pro",
        "tagline": "Smart recovery grid with a hard risk cap.",
        "desc": "A disciplined, capped grid/recovery system with equity-stop "
                "protection — recovery without the blow-up risk of classic grids.",
        "markets": ["Forex"], "timeframe": "M15–H1",
        "strategy": "Capped grid + equity stop",
        "self_optimizing": False, "status": "Beta", "accent": "#4dd0e1",
        "highlights": ["Hard equity stop", "Capped exposure", "Adaptive spacing"],
    },
    {
        "id": "crypto-nomad", "name": "Crypto Nomad", "tier": "Pro",
        "tagline": "24/7 BTC & ETH trend rider.",
        "desc": "Round-the-clock crypto trend-following on BTC and ETH with "
                "volatility-scaled sizing.",
        "markets": ["Crypto"], "timeframe": "M15–H4",
        "strategy": "Trend-following + volatility sizing",
        "self_optimizing": False, "status": "Beta", "accent": "#ff5560",
        "highlights": ["24/7 operation", "Vol-scaled sizing", "Trend filter"],
    },
    {
        "id": "futures-phantom", "name": "Futures Phantom", "tier": "Advanced",
        "tagline": "CME micros & index futures — self-optimizing.",
        "desc": "An RL-assisted futures model for CME micros and index futures. "
                "Pairs with the upcoming Voltex futures prop-firm programme.",
        "markets": ["Futures"], "timeframe": "M1–M30",
        "strategy": "RL-assisted futures momentum",
        "self_optimizing": True, "status": "Coming Soon", "accent": "#c2f53d",
        "highlights": ["CME micros", "RL-assisted", "Prop-futures ready"],
    },
]

TIERS = ["Flagship", "Advanced", "Pro"]


def fleet() -> dict:
    return {"slogans": SLOGANS, "indicators": INDICATORS, "tiers": TIERS,
            "count": len(FLEET), "eas": FLEET}
