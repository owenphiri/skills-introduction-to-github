"""Going global — geo/currency layer tests."""
from backend.data import geo


def test_convert_and_detect():
    assert geo.convert(100, "USD") == 100
    # ZMW ~26.5/USD -> ~2650
    z = geo.convert(19, "ZMW")
    assert 400 < z < 700
    # unknown currency falls back to USD amount
    assert geo.convert(19, "XXX") == 19.0
    assert geo.currency_for_country("Nigeria") == "NGN"
    assert geo.currency_for_country("Narnia") == "USD"
    assert geo.currency_for_country(None) == "USD"


def test_geo_config_endpoint(client):
    r = client.get("/api/geo/config?country=Kenya")
    assert r.status_code == 200
    body = r.json()
    assert body["detected_currency"] == "KES"
    assert body["detected_rail"] == "flutterwave"
    assert any(c["code"] == "USD" for c in body["currencies"])
    assert body["reach"]["countries"] == "190+"
    # default (no country) -> USD / stripe
    d = client.get("/api/geo/config").json()
    assert d["detected_currency"] == "USD" and d["detected_rail"] == "stripe"
