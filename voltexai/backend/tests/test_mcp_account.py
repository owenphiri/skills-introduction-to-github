"""Phase 1 MCP account tools — logic tests (no network, no MCP SDK)."""
import asyncio

from mcp_server import account_tools, adapters, config
from mcp_server.adapters import Account, AccountAdapter, Position
from mcp_server.adapters.base import AccountAccessError
from mcp_server.adapters.deriv import DerivAdapter


def run(coro):
    return asyncio.run(coro)


class FakeAdapter(AccountAdapter):
    name = "fake"

    def __init__(self):
        self.closed = False

    async def get_account(self):
        return Account(broker="fake", account_id="VRTC123", currency="USD",
                       balance=10000.0, equity=10000.0, is_demo=True)

    async def list_positions(self):
        return [
            Position("R_100", "buy", "111", open_price=10.0, current_value=12.5,
                     profit=2.5, kind="CALL", description="Higher than entry"),
            Position("R_75", "sell", "222", open_price=20.0, current_value=18.0,
                     profit=-2.0, kind="PUT", description="Lower than entry"),
        ]

    async def close(self):
        self.closed = True


def _use_fake(monkeypatch):
    fake = FakeAdapter()
    monkeypatch.setattr(adapters, "get_adapter", lambda broker=None: fake)
    return fake


def test_get_account(monkeypatch):
    fake = _use_fake(monkeypatch)
    d = run(account_tools.get_account())
    assert d["account"]["balance"] == 10000.0
    assert d["account"]["is_demo"] is True
    assert "raw" not in d["account"]          # secrets/raw stay out of context
    assert fake.closed is True                # adapter always closed


def test_list_positions(monkeypatch):
    _use_fake(monkeypatch)
    d = run(account_tools.list_positions())
    assert d["count"] == 2
    assert {p["symbol"] for p in d["positions"]} == {"R_100", "R_75"}
    assert d["positions"][0]["direction"] == "buy"


def test_account_summary_rollup(monkeypatch):
    _use_fake(monkeypatch)
    d = run(account_tools.get_account_summary())
    assert d["open_positions"] == 2
    assert d["staked"] == 30.0               # 10 + 20
    assert d["open_profit"] == 0.5           # 2.5 - 2.0


def test_missing_token_is_clean_error(monkeypatch):
    # Real Deriv adapter, but no token configured -> tool returns an error dict,
    # never raises, and never touches the network.
    monkeypatch.setattr(config, "DERIV_API_TOKEN", "")
    monkeypatch.setattr(config, "BROKER", "deriv")
    d = run(account_tools.get_account())
    assert "error" in d and "DERIV_API_TOKEN" in d["error"]


def test_live_account_refused_in_demo_phase(monkeypatch):
    monkeypatch.setattr(config, "ALLOW_LIVE", False)
    a = DerivAdapter(token="x")
    a._authorized = {"loginid": "CR123", "currency": "USD", "is_virtual": 0}
    try:
        run(a.get_account())
        assert False, "live account should be refused"
    except AccountAccessError as exc:
        assert "demo-only" in str(exc)


def test_contract_type_maps_to_direction():
    a = DerivAdapter(token="x")
    assert a._to_position({"contract_type": "CALL", "buy_price": 5}).direction == "buy"
    assert a._to_position({"contract_type": "MULTDOWN", "buy_price": 5}).direction == "sell"
    # unknown types pass through unchanged
    assert a._to_position({"contract_type": "ACCU"}).direction == "ACCU"


def test_unknown_broker_errors(monkeypatch):
    monkeypatch.setattr(config, "BROKER", "nope")
    d = run(account_tools.get_account())
    assert "error" in d and "Unknown broker" in d["error"]
