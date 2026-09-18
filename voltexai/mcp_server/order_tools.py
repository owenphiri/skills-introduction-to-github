"""
Phase 2 tool logic — paper order placement behind the risk layer.

Same discipline as the other tool modules: pure-ish, JSON-able, never raises for
the caller. Every open is gated by RiskLayer.check(); a rejected intent is
returned as {"rejected": True, "reasons": [...]} and never reaches the broker.
Closing a position is always allowed (it reduces risk), even with the kill
switch engaged.

Orders require an order-capable adapter. Only the paper broker supports orders in
Phase 2 — set MCP_BROKER=paper. Read-only adapters (Deriv) return a clear error.
"""
from backend.data import instruments

from .account_tools import _with_adapter
from .adapters.base import OrderIntent
from .risk import RiskConfig, RiskLayer


def _needs_orders(adapter):
    if not getattr(adapter, "supports_orders", False):
        return {"error": (
            "The configured broker is read-only. Phase 2 order tools require the "
            "paper broker — set MCP_BROKER=paper."
        )}
    return None


async def place_order(symbol: str, side: str, size: float) -> dict:
    """Open a paper position after the risk layer approves it."""
    sym = (symbol or "").upper()
    if not instruments.get_instrument(sym):
        return {"error": f"Unknown symbol '{symbol}'. Try list_symbols."}

    async def run(a):
        guard = _needs_orders(a)
        if guard:
            return guard
        intent = OrderIntent(symbol=sym, side=(side or "").lower(), size=size)
        decision = RiskLayer().check(
            intent,
            open_positions=len(await a.list_positions()),
            realized_pnl_today=await a.realized_pnl_today(),
        )
        if not decision.approved:
            return {"rejected": True, "reasons": decision.reasons,
                    "intent": intent.as_dict()}
        fill = await a.place_order(intent)
        return {"filled": fill.as_dict(), "risk": "approved"}

    return await _with_adapter(run)


async def close_position(position_id: str) -> dict:
    """Close an open paper position (always permitted — it reduces risk)."""
    async def run(a):
        guard = _needs_orders(a)
        if guard:
            return guard
        return {"result": await a.close_position(str(position_id))}

    return await _with_adapter(run)


async def get_risk_status() -> dict:
    """Report the active risk limits and how much of the daily-loss budget and
    position slots are used. Read-only."""
    cfg = RiskConfig.from_config()

    async def run(a):
        realized = await a.realized_pnl_today() if getattr(a, "supports_orders", False) else 0.0
        open_n = len(await a.list_positions()) if getattr(a, "supports_orders", False) else 0
        loss_used = max(0.0, -realized)
        return {
            "limits": cfg.as_dict(),
            "usage": {
                "open_positions": open_n,
                "positions_remaining": max(0, cfg.max_open_positions - open_n),
                "realized_pnl_today": round(realized, 2),
                "daily_loss_budget_remaining": round(
                    max(0.0, cfg.max_daily_loss - loss_used), 2),
            },
        }

    return await _with_adapter(run)
