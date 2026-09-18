"""
Phase 1 tool logic — account & open positions (read-only, demo-only).

Same discipline as tools.py: pure, JSON-able, never raises for the caller. Any
adapter/transport/auth failure is returned as {"error": ...}. The broker is
chosen by config (MCP_BROKER); tools never name a specific broker, and no
credential is ever included in a return value.
"""
from . import adapters
from .adapters import AdapterError


async def _with_adapter(fn):
    """Run fn(adapter) with a fresh adapter, always closing it, never raising."""
    try:
        adapter = adapters.get_adapter()
    except AdapterError as exc:
        return {"error": str(exc)}
    try:
        return await fn(adapter)
    except AdapterError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001 - the MCP layer must not see a raise
        return {"error": f"Unexpected adapter failure: {exc}"}
    finally:
        try:
            await adapter.close()
        except Exception:  # noqa: BLE001
            pass


async def get_account() -> dict:
    """Balance/currency/demo-flag for the configured broker account."""
    async def run(a):
        return {"account": (await a.get_account()).as_dict()}
    return await _with_adapter(run)


async def list_positions() -> dict:
    """Open positions for the configured broker account."""
    async def run(a):
        positions = await a.list_positions()
        return {"count": len(positions), "positions": [p.as_dict() for p in positions]}
    return await _with_adapter(run)


async def get_account_summary() -> dict:
    """Account balance plus a roll-up of open positions in one call."""
    async def run(a):
        acct = await a.get_account()
        positions = await a.list_positions()
        return {
            "account": acct.as_dict(),
            "open_positions": len(positions),
            "staked": round(sum(p.open_price for p in positions), 2),
            "open_profit": round(sum(p.profit for p in positions), 2),
            "positions": [p.as_dict() for p in positions],
        }
    return await _with_adapter(run)
