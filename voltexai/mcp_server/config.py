"""
MCP-server configuration (read from the environment).

The MCP server runs as a standalone stdio process, independent of the FastAPI
app, so it reads its own env vars rather than importing backend.config. Secrets
(broker tokens) are read here and handed to adapters; they are never returned by
a tool or placed in the model context.
"""
import os


def _flag(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


# Which broker adapter the account tools use. "deriv" is the Phase 1 adapter.
BROKER = os.getenv("MCP_BROKER", "deriv").strip().lower()

# Phase 1 is demo-only. Set MCP_ALLOW_LIVE=true to permit a real account
# (intentionally hard to enable; live trading is a later, KYC-gated phase).
ALLOW_LIVE = _flag("MCP_ALLOW_LIVE", False)

# --- Deriv (https://api.deriv.com) ---
# app_id 1089 is Deriv's public demo app id; register your own for production.
DERIV_APP_ID = os.getenv("DERIV_APP_ID", "1089").strip()
DERIV_API_TOKEN = os.getenv("DERIV_API_TOKEN", "").strip()
DERIV_WS_URL = os.getenv(
    "DERIV_WS_URL", "wss://ws.derivws.com/websockets/v3"
).strip()
# Network timeout for a single Deriv request/response, seconds.
DERIV_TIMEOUT = float(os.getenv("DERIV_TIMEOUT", "15"))


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# --- Phase 2: paper trading + risk layer ---
# Paper broker simulates fills against the app's live/synthetic prices and
# persists a JSON book. It is the only order-capable adapter; set
# MCP_BROKER=paper to route account + order tools to it.
PAPER_BOOK = os.getenv("MCP_PAPER_BOOK", "voltex_paper_book.json").strip()
PAPER_BALANCE = _float("MCP_PAPER_BALANCE", 10000.0)

# Risk guardrails (operator-set; the agent cannot change these).
MAX_ORDER_SIZE = _float("MCP_MAX_ORDER_SIZE", 1.0)
MAX_OPEN_POSITIONS = _int("MCP_MAX_OPEN_POSITIONS", 5)
MAX_DAILY_LOSS = _float("MCP_MAX_DAILY_LOSS", 500.0)   # account currency, positive
# Comma-separated symbols; empty = allow any known instrument.
SYMBOL_ALLOWLIST = [
    s.strip().upper() for s in os.getenv("MCP_SYMBOL_ALLOWLIST", "").split(",") if s.strip()
]
# Hard stop: when true, the risk layer blocks all new orders.
KILL_SWITCH = _flag("MCP_KILL_SWITCH", False)
