"""
Arbitrage / spread scanner: fee-aware honesty, basis table, and the paper-only,
risk-gated executor.

Core invariant under test: at standard RETAIL taker fees a net-positive cross-venue
edge essentially never appears (fees dominate) — the scanner tells the truth. A
positive edge only surfaces when a professional maker/VIP fee tier is modelled, and
even then it is small. The executor is paper-only and obeys the auto-trader's
kill switch / news guard / enable flag.
"""
import pytest

from backend.services import arbitrage as arb

# A fixed synthetic timestamp (quote bucket) that is deterministic across runs:
# at retail fees it yields 0 net-positive edges, at 2 bps/side it yields a small
# one, and at 0 bps several. Pinning it keeps the fee-tier assertions stable.
FIXED_NOW = 1_700_000_000


# ----------------------------- quotes -----------------------------
def test_venue_quotes_are_ordered_and_costed():
    q = arb.venue_quotes("BTCUSD")
    assert len(q) >= 2
    for v in q:
        assert v["bid"] < v["ask"]              # a real book has a spread
        assert v["fee_bps"] >= 0
        assert "half_spread_bps" in v


def test_uncrosslisted_symbol_has_no_venues():
    # a Deriv-only synthetic index is not cross-listed for cross-venue arb
    assert arb.venue_quotes("V75") == []
    assert arb._opportunity("V75", 10000.0) is None


# ----------------------------- honesty -----------------------------
def test_retail_fees_kill_the_edge():
    """The honest default: standard retail taker fees leave no net-positive edge."""
    sc = arb.scan(now=FIXED_NOW)   # retail-taker fees
    assert sc["actionable_count"] == 0
    for o in sc["opportunities"]:
        assert o["net_bps"] < 0
        assert o["actionable"] is False
        assert o["fee_tier"] == "retail-taker"


def test_disclaimer_and_venues_present():
    sc = arb.scan()
    assert "CFTC Rule 4.41" in sc["disclaimer"]
    assert "Not financial advice" in sc["disclaimer"]
    assert any(v["id"] == "binance" for v in sc["venues"])


def test_pro_fee_tier_can_surface_a_small_edge():
    """At a maker/VIP tier (2 bps/side) a small edge appears on volatile crypto,
    and it stays small — no fantasy numbers."""
    sc = arb.scan(fee_bps_override=2.0, now=FIXED_NOW)
    act = [o for o in sc["opportunities"] if o["actionable"]]
    assert act, "a pro fee tier should surface at least one edge in a scan"
    for o in act:
        assert o["net_bps"] > 0
        assert o["net_bps"] < 40          # realistic: single/low-double-digit bps
        assert o["fee_tier"] == "override"


def test_net_edge_is_gross_minus_costs():
    o = arb._opportunity("ETHUSD", 10000.0, now=FIXED_NOW, fee_bps_override=0.0)
    assert o is not None
    expected = o["gross_bps"] - o["fee_bps"] - o["slippage_bps"]
    assert o["net_bps"] == pytest.approx(expected, abs=1e-6)
    # net_usd is net_bps applied to the notional (both rounded for display)
    assert o["net_usd"] == pytest.approx(o["notional"] * o["net_bps"] / 1e4, abs=0.01)


# ----------------------------- basis -----------------------------
def test_basis_scan_reports_futures_vs_spot():
    b = arb.basis_scan()
    labels = {row["future"] for row in b}
    assert {"GC", "ES", "CL"} <= labels
    for row in b:
        assert row["structure"] in ("contango", "backwardation")
        assert "basis_bps" in row


# ----------------------------- executor gating -----------------------------
def test_run_is_gated_off_by_default(monkeypatch):
    monkeypatch.delenv("AUTOTRADE_ENABLED", raising=False)
    res = arb.run_arbitrage_cycle(fee_bps_override=0.0)
    assert res["ran"] is False
    assert "disabled" in res["reason"]


def test_kill_switch_blocks_run(monkeypatch):
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setenv("AUTOTRADE_KILL_SWITCH", "true")
    res = arb.run_arbitrage_cycle(fee_bps_override=0.0)
    assert res["ran"] is False
    assert "kill switch" in res["reason"]


def test_paper_execution_and_close(tmp_path, monkeypatch):
    monkeypatch.setattr(arb, "ARB_BOOK_PATH", str(tmp_path / "arb_book.json"))
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setenv("AUTOTRADE_KILL_SWITCH", "false")
    monkeypatch.setenv("AUTOTRADE_NEWS_GUARD", "false")

    res = arb.run_arbitrage_cycle(fee_bps_override=0.0, notional=10000.0, now=FIXED_NOW)
    assert res["ran"] is True
    assert res["mode"] == "paper"
    assert res["executed"], "a 0 bps fee tier should book at least one paper pair"
    for pos in res["executed"]:
        assert pos["mode"] == "paper"
        assert pos["long_venue"] != pos["short_venue"]   # a real hedge, two venues

    # positions are marked to the live spread
    open_pos = arb.arb_positions()
    assert len(open_pos) == len(res["executed"])
    first = open_pos[0]
    assert "current_net_bps" in first

    # closing realizes a paper P/L and empties the pair
    out = arb.close_arb(first["id"])
    assert out["symbol"] == first["symbol"]
    assert "realized_usd" in out
    assert len(arb.arb_positions()) == len(open_pos) - 1


def test_no_duplicate_pair_per_symbol(tmp_path, monkeypatch):
    monkeypatch.setattr(arb, "ARB_BOOK_PATH", str(tmp_path / "arb_book2.json"))
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setenv("AUTOTRADE_KILL_SWITCH", "false")
    monkeypatch.setenv("AUTOTRADE_NEWS_GUARD", "false")
    arb.run_arbitrage_cycle(fee_bps_override=0.0, now=FIXED_NOW)
    n1 = len(arb.arb_positions())
    arb.run_arbitrage_cycle(fee_bps_override=0.0, now=FIXED_NOW)   # second run, same symbols
    n2 = len(arb.arb_positions())
    syms = [p["symbol"] for p in arb.arb_positions()]
    assert len(syms) == len(set(syms)), "no symbol should be doubled up"
    assert n2 <= max(n1, arb.arb_status()["max_open"])


# ----------------------------- API -----------------------------
def test_scan_endpoint_public(client):
    r = client.get("/api/arbitrage/scan")
    assert r.status_code == 200
    body = r.json()
    assert body["actionable_count"] == 0        # retail default is honest
    assert "disclaimer" in body


def test_scan_endpoint_fee_tier(client):
    r = client.get("/api/arbitrage/scan", params={"fee_tier_bps": 2.0})
    assert r.status_code == 200
    assert r.json()["fee_tier_bps"] == 2.0


def test_quotes_endpoint(client):
    r = client.get("/api/arbitrage/quotes/BTCUSD")
    assert r.status_code == 200
    assert len(r.json()["venues"]) >= 2
    r2 = client.get("/api/arbitrage/quotes/V75")     # not cross-listed
    assert r2.status_code == 404


def test_run_requires_auth(client):
    assert client.post("/api/arbitrage/run").status_code == 401


def test_run_and_close_authed(client, paid_user):
    r = client.post("/api/arbitrage/run", headers=paid_user["headers"])
    assert r.status_code == 200
    assert "ran" in r.json()
