"""Phase 2 MCP order tools + risk layer — logic tests (no network, no MCP SDK)."""
import asyncio

import pytest

from mcp_server import config, order_tools
from mcp_server.adapters.base import OrderIntent
from mcp_server.risk import RiskConfig, RiskDecision, RiskLayer


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def paper(monkeypatch, tmp_path):
    """Route tools to a fresh paper broker with permissive default limits."""
    monkeypatch.setattr(config, "BROKER", "paper")
    monkeypatch.setattr(config, "PAPER_BOOK", str(tmp_path / "book.json"))
    monkeypatch.setattr(config, "PAPER_BALANCE", 10000.0)
    monkeypatch.setattr(config, "MAX_ORDER_SIZE", 100.0)
    monkeypatch.setattr(config, "MAX_OPEN_POSITIONS", 5)
    monkeypatch.setattr(config, "MAX_DAILY_LOSS", 500.0)
    monkeypatch.setattr(config, "SYMBOL_ALLOWLIST", [])
    monkeypatch.setattr(config, "KILL_SWITCH", False)


# ---- pure risk-layer tests -------------------------------------------------

def _intent(symbol="EURUSD", side="buy", size=1.0):
    return OrderIntent(symbol=symbol, side=side, size=size)


def test_risk_approves_within_limits():
    layer = RiskLayer(RiskConfig(max_order_size=1, max_open_positions=5,
                                 max_daily_loss=500))
    d = layer.check(_intent(), open_positions=0, realized_pnl_today=0)
    assert d.approved and d.reasons == []


def test_risk_blocks_kill_switch_oversize_and_allowlist():
    layer = RiskLayer(RiskConfig(max_order_size=1, max_open_positions=5,
                                 max_daily_loss=500,
                                 symbol_allowlist=["XAUUSD"], kill_switch=True))
    d = layer.check(_intent(symbol="EURUSD", size=5),
                    open_positions=0, realized_pnl_today=0)
    assert not d.approved
    joined = " ".join(d.reasons)
    assert "Kill switch" in joined
    assert "exceeds max_order_size" in joined
    assert "not in the allowlist" in joined


def test_risk_blocks_open_position_and_daily_loss_limits():
    layer = RiskLayer(RiskConfig(max_order_size=10, max_open_positions=2,
                                 max_daily_loss=500))
    d = layer.check(_intent(), open_positions=2, realized_pnl_today=-500)
    assert not d.approved
    joined = " ".join(d.reasons)
    assert "at limit" in joined and "Daily loss limit reached" in joined


def test_risk_rejects_bad_side_and_size():
    layer = RiskLayer(RiskConfig(max_order_size=10, max_open_positions=5,
                                 max_daily_loss=500))
    d = layer.check(_intent(side="hold", size=-3),
                    open_positions=0, realized_pnl_today=0)
    assert not d.approved
    joined = " ".join(d.reasons)
    assert "Invalid side" in joined and "positive number" in joined


# ---- end-to-end paper order flow ------------------------------------------

def test_place_and_close_round_trip(paper):
    filled = run(order_tools.place_order("EURUSD", "buy", 1.0))
    assert filled["risk"] == "approved"
    pid = filled["filled"]["position_id"]
    assert pid == "P1" and filled["filled"]["price"] > 0

    # position persists into a separate tool call (shared book file)
    from mcp_server import account_tools
    positions = run(account_tools.list_positions())
    assert positions["count"] == 1 and positions["positions"][0]["position_id"] == "P1"

    closed = run(order_tools.close_position(pid))["result"]
    assert closed["closed"] == "P1" and "pnl" in closed
    assert run(account_tools.list_positions())["count"] == 0


def test_place_order_rejected_by_size(paper, monkeypatch):
    monkeypatch.setattr(config, "MAX_ORDER_SIZE", 1.0)
    out = run(order_tools.place_order("EURUSD", "buy", 50.0))
    assert out.get("rejected") is True
    assert any("exceeds max_order_size" in r for r in out["reasons"])
    # nothing was opened
    from mcp_server import account_tools
    assert run(account_tools.list_positions())["count"] == 0


def test_kill_switch_blocks_open_but_allows_close(paper, monkeypatch):
    filled = run(order_tools.place_order("EURUSD", "buy", 1.0))
    pid = filled["filled"]["position_id"]
    monkeypatch.setattr(config, "KILL_SWITCH", True)
    blocked = run(order_tools.place_order("EURUSD", "buy", 1.0))
    assert blocked.get("rejected") is True
    # closing still works with the kill switch engaged
    assert run(order_tools.close_position(pid))["result"]["closed"] == pid


def test_unknown_symbol_and_readonly_broker(paper, monkeypatch):
    assert "error" in run(order_tools.place_order("FAKE123", "buy", 1.0))
    monkeypatch.setattr(config, "BROKER", "deriv")
    out = run(order_tools.place_order("EURUSD", "buy", 1.0))
    assert "error" in out and "MCP_BROKER=paper" in out["error"]


def test_risk_status_reports_usage(paper):
    run(order_tools.place_order("EURUSD", "buy", 1.0))
    status = run(order_tools.get_risk_status())
    assert status["limits"]["max_open_positions"] == 5
    assert status["usage"]["open_positions"] == 1
    assert status["usage"]["positions_remaining"] == 4
    assert status["usage"]["daily_loss_budget_remaining"] == 500.0
