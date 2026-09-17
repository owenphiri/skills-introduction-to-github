"""
ICT liquidity engine: pool mapping, draw-on-liquidity, premium/discount, the
sweep→reversal read, the honest scoring rules, and the news-aware assessment +
signal integration. Structural + rule assertions (deterministic where it matters).
"""
from backend.services import liquidity as L
from backend.services import signal_engine as se


# ----------------------------- mapping -----------------------------
def test_map_has_pools_and_zone():
    m = L.liquidity_map("EURUSD")
    assert m["symbol"] == "EURUSD"
    assert m["range"]["zone"] in ("premium", "discount", "equilibrium")
    assert m["pools"], "expected at least one liquidity pool"
    for p in m["pools"]:
        assert p["kind"] in ("BSL", "SSL")
        assert p["side"] in ("above", "below")
        assert p["distance_pips"] >= 0
        assert isinstance(p["swept"], bool)
    assert "CFTC Rule 4.41" in m["disclaimer"]


def test_pools_sorted_by_distance():
    m = L.liquidity_map("XAUUSD")
    d = [p["distance_pips"] for p in m["pools"]]
    assert d == sorted(d)


def test_draw_on_liquidity_shape():
    m = L.liquidity_map("GBPUSD")
    draw = L.draw_on_liquidity(m)
    assert set(draw) == {"buy_side", "sell_side", "likely_draw"}
    if draw["buy_side"]:
        assert draw["buy_side"]["kind"] == "BSL" and draw["buy_side"]["side"] == "above"
    if draw["sell_side"]:
        assert draw["sell_side"]["kind"] == "SSL" and draw["sell_side"]["side"] == "below"
    assert draw["likely_draw"] in ("buy-side", "sell-side", None)


def test_unknown_symbol_errors():
    assert "error" in L.liquidity_map("NOPE")


# ----------------------------- scoring rules (deterministic) -----------------------------
def _lmap(zone):
    return {"range": {"zone": zone}}


def test_score_bounds_and_no_direction():
    assert L.liquidity_score(None, _lmap("discount"), {}, {}, None) == 0.0
    s = L.liquidity_score("LONG", _lmap("discount"),
                          {"likely_draw": "buy-side", "buy_side": None}, {}, None)
    assert 0.0 <= s <= 10.0


def test_discount_long_beats_premium_long():
    draw = {"likely_draw": "buy-side", "buy_side": None, "sell_side": None}
    good = L.liquidity_score("LONG", _lmap("discount"), draw, {}, None)
    bad = L.liquidity_score("LONG", _lmap("premium"), draw, {}, None)
    assert good > bad


def test_sweep_aligned_adds_confluence():
    draw = {"likely_draw": "sell-side", "buy_side": None, "sell_side": None}
    plain = L.liquidity_score("LONG", _lmap("discount"), draw, {"swept": False}, None)
    swept = L.liquidity_score("LONG", _lmap("discount"), draw,
                              {"swept": True, "reversal_bias": "LONG"}, None)
    assert swept > plain


def test_into_liquidity_before_news_is_penalised():
    # long with buy-side liquidity resting 5 pips above = we are the target
    draw = {"likely_draw": "buy-side",
            "buy_side": {"label": "PDH", "distance_pips": 5.0}, "sell_side": None}
    calm = L.liquidity_score("LONG", _lmap("discount"), draw, {}, None)
    news = L.liquidity_score("LONG", _lmap("discount"), draw, {},
                             {"live": True, "event": "FOMC"})
    assert news < calm, "entering into liquidity during live news must score lower"


# ----------------------------- assessment + news -----------------------------
def test_assess_has_stance_and_disclaimer():
    a = L.assess("XAUUSD", "M15", "LONG")
    assert a["symbol"] == "XAUUSD"
    assert isinstance(a["stance"], str) and a["stance"]
    assert a["liquidity_score"] is None or 0.0 <= a["liquidity_score"] <= 10.0
    assert isinstance(a["warnings"], list)
    assert "not a prediction" in a["disclaimer"]


def test_news_board_shape():
    b = L.news_liquidity()
    assert set(b) >= {"generated_at", "count", "board", "disclaimer"}
    assert b["count"] == len(b["board"])
    for row in b["board"]:
        assert row["impact"] in ("high", "medium", "low")
        assert row["likely_draw"] in ("buy-side", "sell-side", None)


# ----------------------------- signal integration -----------------------------
def test_signal_carries_liquidity_block():
    # scan a few symbols; any actionable signal must carry the liquidity context
    saw_actionable = False
    for sym in ("EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "USDJPY", "SOLUSD"):
        sig = se.generate(sym, "M15")
        if sig.get("direction") in ("LONG", "SHORT"):
            saw_actionable = True
            assert "liquidity" in sig
            assert "liquidity_score" in sig      # key present (may be None on soft-fail)
            liq = sig["liquidity"]
            if liq:
                assert liq.get("zone") in ("premium", "discount", "equilibrium")
    assert saw_actionable, "expected at least one actionable signal across the sample"


# ----------------------------- API -----------------------------
def test_api_map(client):
    r = client.get("/api/liquidity/map/EURUSD")
    assert r.status_code == 200
    assert r.json()["pools"]


def test_api_assess_with_direction(client):
    r = client.get("/api/liquidity/assess/XAUUSD", params={"direction": "LONG"})
    assert r.status_code == 200
    assert "stance" in r.json()


def test_api_news_board(client):
    r = client.get("/api/liquidity/news")
    assert r.status_code == 200
    assert "board" in r.json()


def test_api_unknown_symbol_404(client):
    assert client.get("/api/liquidity/map/NOPE").status_code == 404
