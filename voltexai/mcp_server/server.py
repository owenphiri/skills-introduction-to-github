"""
VoltexAI MCP server (Phase 0 — read-only market data).

Run over stdio (how Claude Desktop / IDEs launch it):
    cd voltexai && python -m mcp_server.server

Install the SDK first:  pip install -r requirements-mcp.txt

READ-ONLY by design: quotes, candles and the symbol catalog only. No account
access, no orders. Those arrive in later phases behind the risk layer.
"""
# NOTE: do NOT add `from __future__ import annotations` here. FastMCP introspects
# each tool's parameter annotations at registration time and calls
# issubclass(annotation, Context); stringized annotations make that raise
# `TypeError: issubclass() arg 1 must be a class`. Real annotations (list[str]
# etc.) work natively on Python 3.10+.
from . import tools
from . import account_tools

try:
    from mcp.server.fastmcp import FastMCP
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    raise SystemExit(
        "The MCP SDK isn't installed. From the voltexai/ directory run:\n"
        "    pip install -r requirements-mcp.txt\n"
    ) from exc

mcp = FastMCP(
    "voltexai-markets",
    instructions=(
        "VoltexAI market data + read-only broker account (Phase 1). Use "
        "list_symbols to discover tradable symbols, get_quote/get_quotes for latest "
        "prices, and get_candles for OHLC history. get_account, list_positions and "
        "get_account_summary read a connected DEMO broker account (Deriv) — "
        "read-only. This server cannot place, modify or close trades."
    ),
)


@mcp.tool()
async def list_symbols(asset_class: str = "all") -> dict:
    """List tradable symbols, optionally filtered by asset class
    (forex, metals, energy, indices, crypto, stocks, or 'all')."""
    return await tools.list_symbols(asset_class)


@mcp.tool()
async def get_quote(symbol: str) -> dict:
    """Get the latest quote for one symbol, e.g. 'EURUSD', 'XAUUSD', 'BTCUSD'."""
    return await tools.get_quote(symbol)


@mcp.tool()
async def get_quotes(symbols: list[str]) -> dict:
    """Get the latest quotes for up to 25 symbols in one call."""
    return await tools.get_quotes(symbols)


@mcp.tool()
async def get_candles(symbol: str, timeframe: str = "M15", count: int = 200) -> dict:
    """Get OHLC candles for a symbol. timeframe: M1, M5, M15, M30, H1, H4, D1.
    count: up to 500 (default 200)."""
    return await tools.get_candles(symbol, timeframe, count)


# --- Phase 1: read-only broker account (demo) -------------------------------

@mcp.tool()
async def get_account() -> dict:
    """Get the connected DEMO broker account: balance, currency, demo flag.
    Read-only. Requires a Deriv demo API token in the server environment."""
    return await account_tools.get_account()


@mcp.tool()
async def list_positions() -> dict:
    """List open positions on the connected DEMO broker account. Read-only."""
    return await account_tools.list_positions()


@mcp.tool()
async def get_account_summary() -> dict:
    """Account balance plus a roll-up of open positions (count, staked,
    open profit) in one call. Read-only, demo account."""
    return await account_tools.get_account_summary()


def main() -> None:
    mcp.run()   # stdio transport


if __name__ == "__main__":
    main()
