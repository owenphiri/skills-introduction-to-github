"""
VoltexAI - Broker directory
Reference data for regulated retail brokers, weighted toward those accessible to
African traders (local funding rails, ZAR/NGN support, low minimums). Editorial
reference only — verify regulation status and current spreads before depositing.
Not investment advice; VoltexAI does not receive deposits.
"""
from __future__ import annotations

BROKERS = [
    {
        "id": "exness",
        "name": "Exness",
        "regulators": ["FCA", "CySEC", "FSCA", "FSA-Seychelles"],
        "min_deposit_usd": 10,
        "max_leverage": "1:Unlimited*",
        "spread_eurusd_pips": 0.1,
        "commission": "Zero (Standard) / from $3.5/lot (Raw)",
        "platforms": ["MT4", "MT5", "Exness Terminal"],
        "funding": ["Card", "Skrill", "Neteller", "M-Pesa", "Local bank", "Crypto"],
        "africa_friendly": True,
        "instant_withdrawals": True,
        "instruments": ["forex", "metals", "energy", "indices", "crypto", "stocks"],
        "best_for": "Tightest spreads + instant local withdrawals across Africa.",
        "rating": 4.6,
        "url": "https://exness.com",
    },
    {
        "id": "hfm",
        "name": "HFM (HotForex)",
        "regulators": ["FCA", "CySEC", "FSCA", "DFSA"],
        "min_deposit_usd": 5,
        "max_leverage": "1:2000",
        "spread_eurusd_pips": 0.1,
        "commission": "Zero (Premium) / from $3/lot (Zero)",
        "platforms": ["MT4", "MT5", "HFM App"],
        "funding": ["Card", "Skrill", "Neteller", "Local bank", "Crypto"],
        "africa_friendly": True,
        "instant_withdrawals": True,
        "instruments": ["forex", "metals", "energy", "indices", "crypto", "stocks"],
        "best_for": "Low minimums and strong African support desk.",
        "rating": 4.4,
        "url": "https://hfm.com",
    },
    {
        "id": "fbs",
        "name": "FBS",
        "regulators": ["FSCA", "CySEC", "ASIC", "IFSC"],
        "min_deposit_usd": 5,
        "max_leverage": "1:3000",
        "spread_eurusd_pips": 0.7,
        "commission": "Zero (Standard)",
        "platforms": ["MT4", "MT5", "FBS App"],
        "funding": ["Card", "Skrill", "Neteller", "Local bank", "Crypto"],
        "africa_friendly": True,
        "instant_withdrawals": True,
        "instruments": ["forex", "metals", "energy", "indices", "stocks"],
        "best_for": "High leverage and micro-account accessibility.",
        "rating": 4.1,
        "url": "https://fbs.com",
    },
    {
        "id": "xm",
        "name": "XM",
        "regulators": ["CySEC", "ASIC", "FSCA", "DFSA"],
        "min_deposit_usd": 5,
        "max_leverage": "1:1000",
        "spread_eurusd_pips": 0.6,
        "commission": "Zero (Standard/Micro) / from $3.5/lot (Ultra-Low)",
        "platforms": ["MT4", "MT5", "XM App"],
        "funding": ["Card", "Skrill", "Neteller", "Local bank"],
        "africa_friendly": True,
        "instant_withdrawals": False,
        "instruments": ["forex", "metals", "energy", "indices", "crypto", "stocks"],
        "best_for": "Beginner-friendly with strong education and no deposit fees.",
        "rating": 4.2,
        "url": "https://xm.com",
    },
    {
        "id": "icmarkets",
        "name": "IC Markets",
        "regulators": ["ASIC", "CySEC", "FSA-Seychelles"],
        "min_deposit_usd": 200,
        "max_leverage": "1:500",
        "spread_eurusd_pips": 0.0,
        "commission": "from $3.5/lot (Raw)",
        "platforms": ["MT4", "MT5", "cTrader"],
        "funding": ["Card", "Skrill", "Neteller", "PayPal", "Crypto"],
        "africa_friendly": False,
        "instant_withdrawals": False,
        "instruments": ["forex", "metals", "energy", "indices", "crypto", "stocks"],
        "best_for": "Scalpers & EAs needing true raw-spread ECN execution.",
        "rating": 4.5,
        "url": "https://icmarkets.com",
    },
    {
        "id": "pepperstone",
        "name": "Pepperstone",
        "regulators": ["FCA", "ASIC", "CySEC", "DFSA", "BaFin"],
        "min_deposit_usd": 0,
        "max_leverage": "1:500",
        "spread_eurusd_pips": 0.0,
        "commission": "from $3.5/lot (Razor)",
        "platforms": ["MT4", "MT5", "cTrader", "TradingView"],
        "funding": ["Card", "Skrill", "Neteller", "PayPal"],
        "africa_friendly": False,
        "instant_withdrawals": False,
        "instruments": ["forex", "metals", "energy", "indices", "crypto", "stocks"],
        "best_for": "Heavily regulated, premium execution and TradingView trading.",
        "rating": 4.6,
        "url": "https://pepperstone.com",
    },
    {
        "id": "fxpesa",
        "name": "FXPesa (EGM Securities)",
        "regulators": ["CMA-Kenya"],
        "min_deposit_usd": 10,
        "max_leverage": "1:400",
        "spread_eurusd_pips": 1.2,
        "commission": "Zero (Standard)",
        "platforms": ["MT4", "MT5"],
        "funding": ["M-Pesa", "Card", "Local bank"],
        "africa_friendly": True,
        "instant_withdrawals": True,
        "instruments": ["forex", "metals", "energy", "indices"],
        "best_for": "CMA-regulated, M-Pesa native — built for Kenyan traders.",
        "rating": 4.0,
        "url": "https://fxpesa.com",
    },
    {
        "id": "scope-markets",
        "name": "Scope Markets",
        "regulators": ["CMA-Kenya", "IFSC", "FSC"],
        "min_deposit_usd": 10,
        "max_leverage": "1:500",
        "spread_eurusd_pips": 1.0,
        "commission": "Zero (Standard)",
        "platforms": ["MT4", "MT5"],
        "funding": ["M-Pesa", "Card", "Local bank"],
        "africa_friendly": True,
        "instant_withdrawals": True,
        "instruments": ["forex", "metals", "energy", "indices", "stocks"],
        "best_for": "Locally regulated East-African access with mobile-money rails.",
        "rating": 3.9,
        "url": "https://scopemarkets.com",
    },
]

BROKERS_BY_ID = {b["id"]: b for b in BROKERS}


def list_brokers(asset_class: str | None = None, africa_only: bool = False) -> list[dict]:
    out = BROKERS
    if asset_class and asset_class != "all":
        out = [b for b in out if asset_class in b["instruments"]]
    if africa_only:
        out = [b for b in out if b["africa_friendly"]]
    return out


def get_broker(broker_id: str) -> dict | None:
    return BROKERS_BY_ID.get(broker_id)
