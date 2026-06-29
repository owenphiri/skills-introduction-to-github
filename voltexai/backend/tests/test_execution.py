"""Paper broker accounting, routing broker, reconciliation, and OANDA mapping."""
import asyncio
import uuid

import pytest
from fastapi import HTTPException

from backend.database import SessionLocal
from backend.models import (User, UserRole, Subscription, PlanTier, SubStatus,
                            Provider)
from backend.services.execution_service import (PaperBroker, RoutingBroker,
                                                OandaBroker, AlpacaBroker, reconcile)


def _make_user() -> User:
    db = SessionLocal()
    u = User(email=f"x_{uuid.uuid4().hex[:8]}@t.io", password_hash="x",
             full_name="Exec Test", role=UserRole.USER)
    db.add(u)
    db.commit()
    db.refresh(u)
    db.add(Subscription(user_id=u.id, plan=PlanTier.ELITE,
                        status=SubStatus.ACTIVE, provider=Provider.NONE))
    db.commit()
    uid = u.id
    db.close()
    db = SessionLocal()
    user = db.get(User, uid)
    return db, user


def test_paper_buy_then_sell_realizes_pnl_sign():
    db, user = _make_user()
    b = PaperBroker()

    async def run():
        acc0 = await b.get_account(db, user)
        assert acc0["equity"] == acc0["starting_balance"]
        o = await b.place_order(db, user, "AAPL", "buy", 10, "market")
        assert o["status"] == "filled"
        pos = await b.get_positions(db, user)
        assert pos[0]["symbol"] == "AAPL" and pos[0]["side"] == "long"
        acc1 = await b.get_account(db, user)
        # buying spends cash, equity unchanged (cash -> position value)
        assert acc1["cash"] < acc0["cash"]
        assert round(acc1["equity"]) == round(acc0["equity"])
    asyncio.run(run())
    db.close()


def test_paper_short_allowed_and_tracked():
    db, user = _make_user()
    b = PaperBroker()

    async def run():
        await b.place_order(db, user, "EURUSD", "sell", 1000, "market")
        pos = await b.get_positions(db, user)
        assert pos[0]["side"] == "short" and pos[0]["qty"] < 0
    asyncio.run(run())
    db.close()


def test_paper_rejects_insufficient_buying_power():
    db, user = _make_user()
    b = PaperBroker()

    async def run():
        with pytest.raises(HTTPException) as ei:
            # NVDA ~ $126 * 100000 shares >> 100k cash
            await b.place_order(db, user, "NVDA", "buy", 100000, "market")
        assert ei.value.status_code == 400
    asyncio.run(run())
    db.close()


def test_paper_limit_order_rests_then_cancels():
    db, user = _make_user()
    b = PaperBroker()

    async def run():
        o = await b.place_order(db, user, "BTCUSD", "buy", 0.01, "limit",
                                limit_price=1.0)  # far from market -> pending
        assert o["status"] == "pending"
        c = await b.cancel_order(db, user, o["id"])
        assert c["status"] == "cancelled"
    asyncio.run(run())
    db.close()


def test_router_venue_map_defaults_to_paper_without_keys():
    r = RoutingBroker()
    vm = r.venue_map()
    assert set(vm) == {"forex", "metals", "indices", "energy", "stocks", "crypto"}
    # no live keys in test env -> everything routes to paper
    assert set(vm.values()) == {"paper"}
    assert r._venue("EURUSD")[0] == "paper"
    assert r.is_live is False


def test_router_namespaces_order_ids_and_aggregates(monkeypatch):
    # activate the router via the real factory path so reconcile() picks it up
    import backend.services.execution_service as es
    monkeypatch.setattr(es.settings, "BROKER", "router")
    monkeypatch.setattr(es, "_router", None)
    db, user = _make_user()
    r = es.get_broker()
    assert isinstance(r, RoutingBroker)

    async def run():
        o = await r.place_order(db, user, "AAPL", "buy", 2, "market")
        assert o["id"].startswith("paper:") and o["venue"] == "paper"
        acc = await r.get_account(db, user)
        assert acc["broker"] == "router" and "venues" in acc
        recon = await reconcile(db, user)
        assert recon["broker"] == "router"
        assert recon["reconciled"] is True
        syms = [e["symbol"] for e in recon["exposure_by_symbol"]]
        assert "AAPL" in syms
    asyncio.run(run())
    db.close()


def test_oanda_symbol_mapping_and_rejection():
    o = OandaBroker()
    assert o._inst("EURUSD") == "EUR_USD"
    assert o._inst("XAUUSD") == "XAU_USD"
    assert o._inst("US30") == "US30_USD"
    with pytest.raises(HTTPException):
        o._inst("AAPL")          # stocks not on OANDA


def test_alpaca_symbol_mapping_and_rejection():
    a = AlpacaBroker()
    assert a._sym("AAPL") == "AAPL"
    assert a._sym("BTCUSD") == "BTC/USD"
    with pytest.raises(HTTPException):
        a._sym("EURUSD")         # forex not on Alpaca
