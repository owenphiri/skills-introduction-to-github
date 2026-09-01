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
