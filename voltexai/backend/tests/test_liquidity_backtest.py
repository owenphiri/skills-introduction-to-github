"""
Liquidity-score backtest: walk-forward mechanics, honest synthetic stamping,
bucket accounting, first-touch simulation, and the API. We deliberately do NOT
assert that the score is predictive — on the synthetic feed it need not be, and
the whole point of the tool is to report that truth, not manufacture it.
"""
from backend.services import liquidity_backtest as B


def test_backtest_runs_and_is_stamped_synthetic():
    r = B.backtest("XAUUSD", "M15", bars=700)
    assert r["symbol"] == "XAUUSD"
    assert r["sample"] > 0
    assert r["synthetic"] is True                       # sync feed is synthetic — say so
    assert "SYNTHETIC DATA" in r["disclaimer"]
    assert "live_provider_wired" in r


def test_buckets_account_for_every_trade():
    r = B.backtest("EURUSD", "M15", bars=700)
    counted = sum(b["trades"] for b in r["buckets"])
    assert counted == r["sample"]
    for b in r["buckets"]:
        if b["trades"]:
            assert 0.0 <= b["win_rate"] <= 1.0
            assert b["avg_R"] is not None


def test_overall_winrate_bounded_and_expectancy_finite():
    r = B.backtest("GBPUSD", "M15", bars=700)
    assert 0.0 <= r["overall"]["win_rate"] <= 1.0
    assert isinstance(r["overall"]["avg_R"], float)
    assert r["score_R_correlation"] is None or -1.0 <= r["score_R_correlation"] <= 1.0


def test_first_touch_simulation():
    # LONG: a bar that only reaches TP → +rr; one that hits stop first → -1
    entry, stop, tp, rr = 100.0, 99.0, 102.0, 2.0
    win = [{"high": 102.5, "low": 100.2, "close": 102.1}]
    assert B._forward_R("LONG", entry, stop, tp, win, rr) == rr
    loss = [{"high": 100.4, "low": 98.9, "close": 99.2}]
    assert B._forward_R("LONG", entry, stop, tp, loss, rr) == -1.0
    # straddle bar (both levels) is scored conservatively as the stop
    straddle = [{"high": 102.5, "low": 98.5, "close": 100.0}]
    assert B._forward_R("LONG", entry, stop, tp, straddle, rr) == -1.0


def test_no_lookahead_uses_only_past_candles(monkeypatch):
    # Assert the window passed to the scorer never extends past the entry bar.
    seen = {}
    real = B.liquidity.score_from_candles

    def spy(symbol, candles, direction, news=None):
        seen["max_len"] = max(seen.get("max_len", 0), len(candles))
        return real(symbol, candles, direction, news)

    monkeypatch.setattr(B.liquidity, "score_from_candles", spy)
    r = B.backtest("XAUUSD", "M15", bars=500, horizon=20)
    # last entry index is len-horizon-1; the largest window is that +1 bar of history
    assert seen["max_len"] <= 500 - 20            # never sees the forward/horizon bars


def test_insufficient_history_errors():
    r = B.backtest("XAUUSD", "M15", bars=300, horizon=24, warmup=290)
    assert r.get("error")


def test_backtest_many_aggregates():
    m = B.backtest_many(["EURUSD", "GBPUSD"], "M15", bars=600)
    assert m["symbols"] >= 1
    assert m["synthetic"] is True
    assert len(m["per_symbol"]) == m["symbols"]


# ----------------------------- API -----------------------------
def test_api_backtest_symbol(client):
    r = client.get("/api/liquidity/backtest/XAUUSD")
    assert r.status_code == 200
    body = r.json()
    assert body["sample"] > 0 and body["synthetic"] is True
    assert "buckets" in body and "verdict" in body


def test_api_backtest_board(client):
    r = client.get("/api/liquidity/backtest")
    assert r.status_code == 200
    assert "per_symbol" in r.json()


def test_api_backtest_unknown_404(client):
    assert client.get("/api/liquidity/backtest/NOPE").status_code == 404
