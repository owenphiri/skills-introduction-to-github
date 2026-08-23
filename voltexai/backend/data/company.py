"""
VoltexAI corporate & media content — the single source of truth for the company
surfaces: About, Careers, CSR, Press, TV, Media-FinTech, Podcast, Blogs, Offers,
Awards, FAQ and the VoltexAI Foundation. Also holds the color-coded "cardinal"
brand phrases and the global-presence map. Content is representative and safe to
edit as the company grows.
"""
from __future__ import annotations

# Mission / brand line the user asked to feature prominently.
MISSION = {
    "headline": "Financial Freedom — Bridging the Gap.",
    "sub": "VoltexAI Technologies puts an institutional-grade trading desk in "
           "every African pocket — and connects the continent to the world.",
}

# Color-coded "cardinal" fancy phrases (each mapped to a brand accent).
CARDINAL_PHRASES = [
    {"text": "Trade Smart", "color": "#4d7cff"},
    {"text": "Trade Safe", "color": "#45e0a0"},
    {"text": "Trade Consistently", "color": "#c2f53d"},
    {"text": "Bridging the Gap", "color": "#ffb547"},
    {"text": "Africa to the World", "color": "#a06bff"},
    {"text": "Knowledge is Leverage", "color": "#ff5560"},
    {"text": "Discipline over Emotion", "color": "#4dd0e1"},
    {"text": "Financial Freedom", "color": "#c2f53d"},
]

# "Across the globe" — regional footprint.
GLOBAL_PRESENCE = {
    "countries": 27,
    "traders": "48,000+",
    "regions": [
        {"name": "Southern Africa", "flag": "🌍", "hubs": ["Lusaka", "Johannesburg", "Harare", "Gaborone"]},
        {"name": "East Africa", "flag": "🌍", "hubs": ["Nairobi", "Dar es Salaam", "Kampala", "Kigali"]},
        {"name": "West Africa", "flag": "🌍", "hubs": ["Lagos", "Accra", "Abidjan", "Dakar"]},
        {"name": "Middle East", "flag": "🌏", "hubs": ["Dubai", "Abu Dhabi", "Doha"]},
        {"name": "Europe", "flag": "🌍", "hubs": ["London", "Lisbon", "Amsterdam"]},
        {"name": "North America", "flag": "🌎", "hubs": ["Toronto", "Atlanta", "New York"]},
    ],
}

ABOUT = {
    "founded": 2017,
    "established": "EST. 2017",
    "story": [
        "VoltexAI began in Kasama, Zambia with a simple conviction: an African "
        "trader with the right tools can compete with anyone on earth.",
        "We built the operating system for that trader — live markets, AI "
        "signals, chart vision, an academy and managed alpha — all in one place.",
        "Today VoltexAI spans 27 countries and is bridging the gap between "
        "African talent and global financial opportunity.",
    ],
    "values": [
        {"icon": "🛡️", "title": "Safety first", "desc": "Risk management is the product. We teach survival before profit."},
        {"icon": "🌍", "title": "Africa-built, global", "desc": "Designed for M-Pesa and mobile money, benchmarked against the world."},
        {"icon": "🎓", "title": "Education as equity", "desc": "Knowledge compounds. We give it away generously."},
        {"icon": "⚡", "title": "Relentless craft", "desc": "Institutional quality, retail access, no compromises."},
    ],
    "leadership": [
        {"name": "OP OWENS PHIRI", "role": "Founder & CEO", "bio": "Trader, educator and founder of Owens Forex Academy. Building VoltexAI since 2017."},
        {"name": "Axion Labs Technologies", "role": "Powered by", "bio": "Axion Labs Technologies — the technology company behind VoltexAI."},
    ],
}

# What VoltexAI actually does — explained for About + FAQ.
SERVICES = [
    {"icon": "⚡", "title": "VoltexAI — the platform",
     "desc": "An all-in-one AI trading terminal: live markets, AI signals, chart "
             "vision, a market scanner, an academy, managed alpha, payments and more "
             "— the operating system for the modern trader."},
    {"icon": "🏦", "title": "FinTech",
     "desc": "Africa-native financial technology — mobile-money-first funding "
             "(M-Pesa, MTN, Airtel), cards, crypto and bank rails via Voltex Pay, "
             "plus secure accounts and KYC built for cross-border traders."},
    {"icon": "📈", "title": "Trading",
     "desc": "Forex, metals, indices, crypto and stocks — real-time prices, "
             "AI-ranked signals with entry/stop/targets, a scanner for confluence "
             "setups, and an advanced trade journal to track and improve."},
    {"icon": "🏆", "title": "Prop Firms",
     "desc": "Independent prop-firm intelligence — compare funded-account models, "
             "profit splits, rules and payouts, and get matched to the right "
             "challenge. Futures prop firms are coming soon."},
    {"icon": "🏛️", "title": "Brokers",
     "desc": "Regulated broker comparisons ranked by spreads, leverage and "
             "Africa-friendly funding — including Exness, HFM and Vantage Markets "
             "— so you deposit with confidence."},
]

# Prop firms for futures trading — announced, not yet live.
FUTURES_COMING_SOON = {
    "title": "Prop Firms for Futures Trading",
    "status": "Coming Soon",
    "desc": "Funded futures accounts (CME micros, indices, energies & metals) with "
            "the same VoltexAI comparison, matching and intelligence you get for FX "
            "prop firms. Join the waitlist to get early access.",
    "features": ["CME & micro futures", "Evaluation & instant-funding models",
                 "Futures-native risk rules", "Matched to your style"],
}

CAREERS = {
    "pitch": "Build the financial operating system for a continent. Remote-first, Africa-proud, globally ambitious.",
    "perks": ["Remote-first", "Equity for early team", "Learning budget", "Prop-account access", "Summit travel"],
    "roles": [
        {"id": "fe-eng", "title": "Senior Frontend Engineer", "team": "Product", "location": "Remote (GMT±3)", "type": "Full-time"},
        {"id": "quant", "title": "Quantitative Researcher", "team": "Signals", "location": "Remote", "type": "Full-time"},
        {"id": "ml-eng", "title": "ML Engineer (LLM/Agents)", "team": "AI", "location": "Remote", "type": "Full-time"},
        {"id": "community", "title": "Community Lead — West Africa", "team": "Growth", "location": "Lagos", "type": "Full-time"},
        {"id": "content", "title": "Trading Educator / Host", "team": "Academy & Media", "location": "Lusaka / Remote", "type": "Contract"},
    ],
}

CSR = {
    "headline": "Trading up the whole community.",
    "programs": [
        {"icon": "📚", "title": "1,000 Scholarships", "desc": "Free Academy access for students across Africa each year."},
        {"icon": "💻", "title": "Digital Skills Labs", "desc": "Community labs equipping youth with fintech & coding skills."},
        {"icon": "👩🏾‍💼", "title": "Women in Markets", "desc": "Mentorship and funded challenges for women traders."},
        {"icon": "🌱", "title": "Green Desks", "desc": "Carbon-aware infrastructure and tree-planting per funded trader."},
    ],
}

FOUNDATION = {
    "name": "VoltexAI Foundation",
    "mission": "Bridging the financial-literacy gap — one community at a time.",
    "pillars": [
        {"icon": "🎓", "title": "Literacy", "desc": "Free financial-literacy curriculum for schools and churches."},
        {"icon": "🤝", "title": "Access", "desc": "Devices and data grants so talent isn't gated by hardware."},
        {"icon": "🚀", "title": "Opportunity", "desc": "Seed funding and mentorship for standout graduate traders."},
    ],
    "impact": [{"value": "12,000+", "label": "Learners reached"},
               {"value": "38", "label": "Community labs"},
               {"value": "27", "label": "Countries"}],
}

PRESS = {
    "contact": "press@voltexai.app",
    "releases": [
        {"id": "pr-summit-2026", "date": "2026-05-14", "title": "VoltexAI Global Summit lands in Dubai",
         "summary": "Prop firms, brokers and investors gather for the platform's first global edition.", "tag": "Events"},
        {"id": "pr-27-countries", "date": "2026-03-02", "title": "VoltexAI crosses 27 countries",
         "summary": "The African trading OS surpasses 48,000 traders across the continent and diaspora.", "tag": "Growth"},
        {"id": "pr-vision", "date": "2026-01-20", "title": "Voltex Vision brings chart analysis to any screenshot",
         "summary": "New AI reads market structure, liquidity and order blocks from a single image.", "tag": "Product"},
    ],
    "mentions": [
        {"outlet": "TechCabal", "quote": "A serious contender for Africa's fintech-trading crown."},
        {"outlet": "Disrupt Africa", "quote": "Institutional tooling, mobile-money native."},
    ],
}

TV_SHOWS = [
    {"id": "tv-market-open", "title": "The Market Open", "schedule": "Weekdays · 07:00 UTC",
     "host": "Owens Forex Academy", "desc": "Live London-open breakdown and the day's game plan.", "thumb": "🔴"},
    {"id": "tv-desk", "title": "On The Desk", "schedule": "Wed · 18:00 UTC", "host": "VoltexAI Desk",
     "desc": "Behind the trades with the VoltexAI trading desk.", "thumb": "🎥"},
    {"id": "tv-masterclass", "title": "Masterclass", "schedule": "Sat · 15:00 UTC", "host": "OP OWENS PHIRI",
     "desc": "Deep-dive masterclasses on structure, risk and psychology.", "thumb": "🎓"},
]

# VoltexAI TV — YouTube channel integration.
# To enable the embedded LIVE player, set channel_id to the channel's UC… id.
# To feature a specific stream/replay, set live_video_id to a YouTube video id.
YOUTUBE = {
    "channel_handle": "@VoltexAI",
    "channel_url": "https://www.youtube.com/@VoltexAI",
    "subscribe_url": "https://www.youtube.com/@VoltexAI?sub_confirmation=1",
    "channel_id": "",          # e.g. "UCxxxxxxxxxxxxxxxxxxxxxx" -> enables live embed
    "live_video_id": "",       # e.g. "dQw4w9WgXcQ" -> features that video
    "featured": [
        {"title": "The Market Open — London breakdown", "video_id": "", "thumb": "🔴"},
        {"title": "NY Killzone live trading", "video_id": "", "thumb": "🎥"},
        {"title": "SMC Masterclass with OP OWENS PHIRI", "video_id": "", "thumb": "🎓"},
    ],
}

MEDIA = {
    "tagline": "VoltexAI Media — FinTech, storytelling & the future of African finance.",
    "verticals": [
        {"icon": "📺", "title": "VoltexAI TV", "desc": "Live shows and market breakdowns.", "route": "/tv"},
        {"icon": "🎙️", "title": "VoltexAI Podcast", "desc": "Conversations with traders and builders.", "route": "/podcast"},
        {"icon": "📝", "title": "Blogs", "desc": "Research, education and product notes.", "route": "/blog"},
    ],
}

PODCASTS = [
    {"id": "ep-12", "ep": 12, "title": "From M-Pesa to the markets", "guest": "Wanjiru K.",
     "duration": "42 min", "desc": "How mobile money became a gateway to global trading.", "date": "2026-06-01"},
    {"id": "ep-11", "ep": 11, "title": "Risk is the only edge", "guest": "OP OWENS PHIRI",
     "duration": "55 min", "desc": "Why survival beats prediction, every time.", "date": "2026-05-18"},
    {"id": "ep-10", "ep": 10, "title": "Building AI that trades responsibly", "guest": "VoltexAI AI Team",
     "duration": "38 min", "desc": "Inside Voltex Signals and Vision.", "date": "2026-05-04"},
]

BLOGS = [
    {"id": "smc-basics", "title": "Smart Money Concepts, without the hype", "author": "Owens Forex Academy",
     "date": "2026-06-10", "read_min": 7, "tag": "Education",
     "excerpt": "Order blocks and liquidity explained in plain language — and how to actually trade them."},
    {"id": "prop-guide", "title": "How to pass a prop challenge (and keep the account)", "author": "VoltexAI Desk",
     "date": "2026-05-22", "read_min": 9, "tag": "Prop",
     "excerpt": "The rules that fail most traders — and the risk plan that gets you funded."},
    {"id": "mobile-money", "title": "Funding your trading with mobile money in Africa", "author": "VoltexAI",
     "date": "2026-05-05", "read_min": 6, "tag": "Guides",
     "excerpt": "M-Pesa, MTN and Airtel — the practical guide to funding and withdrawing safely."},
    {"id": "ai-signals", "title": "What makes a good AI trading signal", "author": "VoltexAI AI Team",
     "date": "2026-04-18", "read_min": 8, "tag": "Product",
     "excerpt": "Confluence, risk brackets and why a signal without a stop is just a guess."},
]

OFFERS = [
    {"id": "founding-50", "title": "Founding Trader — 50% off Elite", "badge": "Limited",
     "desc": "Lock lifetime founding pricing on the Elite plan.", "cta": "Claim offer", "route": "/pricing", "accent": "#c2f53d"},
    {"id": "academy-free", "title": "Academy Free Week", "badge": "New",
     "desc": "Seven days of full Academy access — no card required.", "cta": "Start learning", "route": "/academy", "accent": "#4d7cff"},
    {"id": "prop-discount", "title": "Prop Challenge Discounts", "badge": "Partner",
     "desc": "Up to 20% off partner prop-firm challenges.", "cta": "See firms", "route": "/prop-firms", "accent": "#45e0a0"},
    {"id": "refer", "title": "Refer & Earn", "badge": "Always on",
     "desc": "Give a month, get a month. Bring the team.", "cta": "Get your link", "route": "/account", "accent": "#a06bff"},
]

AWARDS = [
    {"id": "aw-fintech-2026", "year": 2026, "title": "Best African FinTech Startup", "org": "Africa Tech Awards", "icon": "🏆"},
    {"id": "aw-edu-2026", "year": 2026, "title": "EdTech Innovation of the Year", "org": "Learning Africa", "icon": "🥇"},
    {"id": "aw-people-2025", "year": 2025, "title": "People's Choice — Trading App", "org": "Zambia Digital Awards", "icon": "🌟"},
    {"id": "aw-ai-2025", "year": 2025, "title": "Applied AI Excellence", "org": "AI Summit Africa", "icon": "🤖"},
]

FAQ = [
    {"q": "Is VoltexAI a broker?", "a": "No. VoltexAI is a technology and education platform. We connect you to regulated brokers and prop firms, and give you the tools and signals — we never hold your trading funds."},
    {"q": "Do you offer financial advice?", "a": "No. Everything on VoltexAI is educational technology, not personalised investment advice. Trading leveraged products carries a high risk of loss."},
    {"q": "How do I fund my account?", "a": "Through your chosen broker using cards, bank transfer, crypto or mobile money (M-Pesa, MTN, Airtel). Voltex Pay shows the options available in your country."},
    {"q": "Which countries do you support?", "a": "27 and counting across Africa, the Middle East, Europe and North America. The platform works anywhere with internet."},
    {"q": "Is there a free plan?", "a": "Yes. You can explore markets, sentiment and parts of the Academy for free. Paid plans unlock signals, Vision, the scanner and more."},
    {"q": "How do the AI signals work?", "a": "A quant engine plus Claude-grade AI rank setups with entry, stop and targets. They are ideas to research, never guarantees."},
    {"q": "Can I cancel anytime?", "a": "Yes — subscriptions are month-to-month and you can cancel from your account at any time."},
    {"q": "What is a prop firm and how does VoltexAI help?", "a": "A proprietary-trading (prop) firm funds you to trade their capital after you pass an evaluation, then shares the profits. Voltex Prop Intel compares firms by model, profit split, rules and payouts and matches you to the right challenge. We are independent — we don't take your funds."},
    {"q": "Do you support futures prop firms?", "a": "Prop firms for futures trading (CME micros, indices, energies and metals) are Coming Soon. You'll be able to compare funded-futures programs with the same VoltexAI intelligence — join the waitlist from the Prop Firms page."},
    {"q": "Which brokers do you compare?", "a": "Regulated, Africa-friendly brokers ranked by spreads, leverage and funding options — including Exness, HFM and Vantage Markets. We show the facts; you choose and deposit directly with the broker."},
    {"q": "What does 'FinTech' mean here?", "a": "VoltexAI is financial technology built for Africa: mobile-money-first funding (M-Pesa, MTN, Airtel), cards, crypto and bank rails through Voltex Pay, plus secure accounts and KYC designed for cross-border traders."},
    {"q": "Who is behind VoltexAI?", "a": "VoltexAI is founded and led by OP OWENS PHIRI (Founder & CEO), building since 2017, and is powered by Axion Labs Technologies. Trading methodology is by Owens Forex Academy."},
]

# route -> label map for the sitemap page and sitemap.xml
SITEMAP = [
    {"section": "Platform", "links": [
        ["/", "Home"], ["/dashboard", "Command Center"], ["/markets", "Markets"],
        ["/signals", "Signals"], ["/scanner", "Scanner"], ["/vision", "Vision"],
        ["/sentiment", "Sentiment"], ["/live", "Live Sessions"], ["/terminal", "Terminal"]]},
    {"section": "Grow", "links": [
        ["/academy", "Academy"], ["/resources", "Resources"], ["/competition", "Competition"],
        ["/community", "Community"], ["/success", "Success Stories"], ["/travel", "Travel"]]},
    {"section": "Money", "links": [
        ["/aum", "Managed Alpha"], ["/pay", "Pay"], ["/store", "Store"],
        ["/pricing", "Pricing"], ["/prop-firms", "Prop Firms"], ["/brokers", "Brokers"]]},
    {"section": "Company", "links": [
        ["/about", "About Us"], ["/careers", "Careers"], ["/press", "Press"],
        ["/csr", "Corporate Social Responsibility"], ["/foundation", "VoltexAI Foundation"],
        ["/awards", "Awards"]]},
    {"section": "Media", "links": [
        ["/media", "VoltexAI Media — FinTech"], ["/tv", "VoltexAI TV"],
        ["/podcast", "VoltexAI Podcast"], ["/blog", "Blogs"]]},
    {"section": "Explore", "links": [
        ["/offers", "Offers"], ["/faq", "FAQ"], ["/products", "Ecosystem"], ["/sitemap", "Sitemap"]]},
]


def content() -> dict:
    return {
        "mission": MISSION, "phrases": CARDINAL_PHRASES, "global": GLOBAL_PRESENCE,
        "about": ABOUT, "services": SERVICES, "futures": FUTURES_COMING_SOON,
        "careers": CAREERS, "csr": CSR, "foundation": FOUNDATION,
        "press": PRESS, "tv": TV_SHOWS, "youtube": YOUTUBE, "media": MEDIA, "podcast": PODCASTS,
        "blog": BLOGS, "offers": OFFERS, "awards": AWARDS, "faq": FAQ,
        "sitemap": SITEMAP,
    }


def all_routes() -> list[str]:
    seen: list[str] = []
    for grp in SITEMAP:
        for path, _ in grp["links"]:
            if path not in seen:
                seen.append(path)
    return seen
