"""Alpha Vantage provider wiring (offline — no key set in tests)."""
import asyncio

from backend.services import data_providers as dp


def test_status_exposes_alphavantage_flag():
    st = dp.provider_status()
    assert "alphavantage_key_present" in st
    assert st["alphavantage_key_present"] is False   # no key in the hermetic test env


def test_av_pair_mapping():
    assert dp._av_pair("EURUSD") == ("EUR", "USD")
    assert dp._av_pair("BTCUSD") == ("BTC", "USD")
    assert dp._av_pair("US30") is None


def test_av_series_parses_and_orders():
    series = {
        "2026-08-20 10:00:00": {"1. open": "1.10", "2. high": "1.12", "3. low": "1.09", "4. close": "1.11", "5. volume": "5"},
        "2026-08-20 10:05:00": {"1. open": "1.11", "2. high": "1.13", "3. low": "1.10", "4. close": "1.125", "5. volume": "7"},
    }
    out = dp._av_series(series, 10)
    assert len(out) == 2 and out[0]["time"] <= out[1]["time"]
    assert out[1]["close"] == 1.125


def test_av_quote_returns_none_without_key():
    # no ALPHAVANTAGE_API_KEY in the test env -> graceful None, no network call
    assert asyncio.get_event_loop().run_until_complete(dp.alphavantage_quote("EURUSD")) is None


def test_news_label_bands():
    assert dp._news_label(-0.5) == "Bearish"
    assert dp._news_label(-0.2) == "Somewhat-Bearish"
    assert dp._news_label(0.0) == "Neutral"
    assert dp._news_label(0.2) == "Somewhat-Bullish"
    assert dp._news_label(0.5) == "Bullish"


def test_news_sentiment_none_without_key():
    assert asyncio.get_event_loop().run_until_complete(dp.alphavantage_news_sentiment()) is None


def test_sentiment_endpoint_includes_news_layer(client):
    d = client.get("/api/sentiment").json()
    # the Alpha Vantage news layer is always present; unavailable (no key) offline
    assert "news" in d and d["news"]["available"] is False
    assert d["news"]["articles"] == []
