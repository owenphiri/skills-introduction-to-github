"""VoltexAI MCP server (Phase 0) — tool-logic tests (no MCP SDK required)."""
import asyncio
from mcp_server import tools


def run(coro):
    return asyncio.run(coro)


def test_list_symbols():
    d = run(tools.list_symbols("all"))
    assert d["count"] > 0 and any(s["symbol"] == "EURUSD" for s in d["symbols"])
    fx = run(tools.list_symbols("forex"))
    assert all(s["asset_class"] == "forex" for s in fx["symbols"])
    bad = run(tools.list_symbols("nope"))
    assert "error" in bad and "asset_classes" in bad


def test_get_quote():
    q = run(tools.get_quote("xauusd"))          # case-insensitive
    assert q.get("symbol") == "XAUUSD" and "price" in q
    assert "error" in run(tools.get_quote("FAKE123"))


def test_get_quotes_batch_and_unknown():
    d = run(tools.get_quotes(["EURUSD", "BTCUSD", "NOPE"]))
    got = {q["symbol"] for q in d["quotes"]}
    assert {"EURUSD", "BTCUSD"} <= got
    assert d["unknown"] == ["NOPE"]
    assert "error" in run(tools.get_quotes([]))


def test_get_candles():
    d = run(tools.get_candles("EURUSD", "H1", 50))
    assert d["symbol"] == "EURUSD" and d["timeframe"] == "H1"
    assert d["count"] == 50 and len(d["candles"]) == 50
    c0 = d["candles"][0]
    assert {"open", "high", "low", "close"} <= set(c0)
    # guards
    assert "error" in run(tools.get_candles("EURUSD", "X9"))
    assert "error" in run(tools.get_candles("FAKE"))
    # count is clamped, never raises
    assert run(tools.get_candles("EURUSD", "M15", 100000))["count"] <= 500
