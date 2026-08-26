"""Pricing — 5-tier product ladder catalog + plan-tier ordering."""
from backend.models import PlanTier


def test_plan_catalog_is_five_tier_ladder(client):
    body = client.get("/api/payments/plans").json()
    plans = body["plans"]
    ids = [p["id"] for p in plans]
    assert ids == ["free", "starter", "trader", "pro", "elite"]

    by_id = {p["id"]: p for p in plans}
    assert by_id["free"]["usd"] == 0
    assert by_id["starter"]["usd"] == 19
    assert by_id["trader"]["usd"] == 49
    assert by_id["pro"]["usd"] == 99
    assert by_id["elite"]["usd"] == 199

    # prices strictly increase up the ladder
    usds = [by_id[i]["usd"] for i in ids]
    assert usds == sorted(usds) and len(set(usds)) == len(usds)

    # ZMW is derived from USD, every paid tier carries a tagline + features
    for p in plans:
        assert p["zmw"] >= 0
        assert p["ai_calls_per_day"] >= 1
        if p["id"] != "free":
            assert p["tagline"] and p["features"]


def test_annual_billing_discount(client):
    body = client.get("/api/payments/plans").json()
    b = body["billing"]
    assert b["months_free"] == 2 and b["discount_pct"] == 17
    assert "2 months free" in b["label"]

    by_id = {p["id"]: p for p in body["plans"]}
    # 2 months free -> annual = 10x monthly
    assert by_id["trader"]["usd_annual"] == 490
    assert by_id["pro"]["usd_annual"] == 990
    assert by_id["elite"]["usd_annual"] == 1990
    # savings vs 12x monthly = 2 months
    assert by_id["trader"]["annual_savings_usd"] == 98    # 49 * 2
    assert by_id["elite"]["annual_savings_usd"] == 398    # 199 * 2
    # per-month-equivalent is cheaper than the monthly price for every paid tier
    for pid in ("starter", "trader", "pro", "elite"):
        p = by_id[pid]
        assert p["usd_annual_monthly"] < p["usd"]
        assert p["annual_discount_pct"] == 17
    # free stays free on either cadence
    assert by_id["free"]["usd_annual"] == 0 and by_id["free"]["annual_discount_pct"] == 0


def test_checkout_accepts_annual_interval(client, paid_user):
    # Stripe annual price id isn't configured in tests -> reaches the service and
    # fails there (502), proving the 'year' interval is accepted by validation.
    r = client.post("/api/payments/stripe/checkout",
                    headers=paid_user["headers"], json={"plan": "pro", "interval": "year"})
    assert r.status_code == 502
    # a bogus interval is rejected by request validation (422)
    bad = client.post("/api/payments/stripe/checkout",
                      headers=paid_user["headers"], json={"plan": "pro", "interval": "weekly"})
    assert bad.status_code == 422


def test_plan_rank_ordering():
    assert PlanTier.FREE.rank < PlanTier.STARTER.rank < PlanTier.TRADER.rank \
        < PlanTier.PRO.rank < PlanTier.ELITE.rank
    assert PlanTier.PRO.at_least(PlanTier.TRADER)
    assert not PlanTier.STARTER.at_least(PlanTier.TRADER)
    assert PlanTier.ELITE.at_least(PlanTier.ELITE)


def test_checkout_rejects_unknown_plan(client, paid_user):
    # 'free' and 'vip_pro' are not purchasable subscription tiers
    r = client.post("/api/payments/stripe/checkout",
                    headers=paid_user["headers"], json={"plan": "free"})
    assert r.status_code == 422
