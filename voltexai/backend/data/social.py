"""
Voltex social proof & testimonials.
Powers the bottom-left activity toasts and the Success Stories page.

NOTE FOR OPERATORS: the personas below are REPRESENTATIVE marketing samples, not
real named customers. The live proof feed prefers REAL recent platform activity
(e.g. contest entries) and falls back to these samples so the widget is never empty.
Replace samples with genuine, consented testimonials before relying on them in
regulated advertising.
"""
from __future__ import annotations

# (first name, country, city) personas for the activity feed
PERSONAS = [
    ("Chanda", "Zambia", "Lusaka"), ("Amara", "Nigeria", "Lagos"),
    ("Wanjiru", "Kenya", "Nairobi"), ("Kwame", "Ghana", "Accra"),
    ("Thandiwe", "South Africa", "Johannesburg"), ("Musa", "Uganda", "Kampala"),
    ("Zola", "South Africa", "Cape Town"), ("Ibrahim", "Nigeria", "Abuja"),
    ("Neo", "Botswana", "Gaborone"), ("Fatou", "Senegal", "Dakar"),
    ("James", "United Kingdom", "London"), ("Sofia", "Portugal", "Lisbon"),
    ("Diego", "Mexico", "Mexico City"), ("Aisha", "UAE", "Dubai"),
    ("Ravi", "India", "Mumbai"), ("Mateus", "Brazil", "São Paulo"),
    ("Chloe", "Canada", "Toronto"), ("Yuki", "Japan", "Tokyo"),
    ("Tariq", "Tanzania", "Dar es Salaam"), ("Lerato", "Zambia", "Kitwe"),
]

COURSES = [
    "SMC Masterclass Bundle", "Trader Mindset Program", "Candlesticks Decoded",
    "Market Structure Mastery", "Liquidity, Order Blocks & FVGs",
    "Risk Management That Keeps You Alive", "Crypto Futures & Perps",
    "Elite Plan", "Trader Plan", "Voltex Risk Guard EA",
]

TESTIMONIALS = [
    {"name": "Chanda M.", "country": "Zambia", "role": "Funded trader",
     "avatar": "C", "rating": 5,
     "quote": "Voltex Academy took me from blowing accounts to passing a $100K "
              "prop challenge in 3 months. The AI tutor is like having a mentor 24/7."},
    {"name": "Amara O.", "country": "Nigeria", "role": "Part-time trader",
     "avatar": "A", "rating": 5,
     "quote": "Funding with MTN MoMo just works. Voltex Signals sharpened my entries — "
              "my win rate went from guesswork to a real edge."},
    {"name": "Wanjiru K.", "country": "Kenya", "role": "Swing trader",
     "avatar": "W", "rating": 5,
     "quote": "I won the Weekly Sprint twice. Competing on the leaderboard keeps me "
              "disciplined and the paper desk means zero risk while I learn."},
    {"name": "James R.", "country": "United Kingdom", "role": "Prop trader",
     "avatar": "J", "rating": 5,
     "quote": "Voltex Vision reads my charts better than analysts I used to pay for. "
              "Upload, get the plan, execute. Ridiculously good."},
    {"name": "Aisha H.", "country": "UAE", "role": "Investor",
     "avatar": "A", "rating": 5,
     "quote": "I don't have time to trade, so I allocate to Voltex Alpha. Transparent "
              "dashboard, segregated account — exactly what I wanted."},
    {"name": "Thandiwe N.", "country": "South Africa", "role": "New trader",
     "avatar": "T", "rating": 5,
     "quote": "The Academy explains candlesticks and market structure so simply. "
              "First time trading has actually made sense to me."},
]

STAT_HIGHLIGHTS = [
    {"value": "14+", "label": "Countries"},
    {"value": "38%", "label": "Avg. AUM growth (illustrative)"},
    {"value": "4.8/5", "label": "Learner rating"},
    {"value": "24/7", "label": "AI mentor uptime"},
]
