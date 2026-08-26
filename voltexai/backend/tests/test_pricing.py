"""Pricing — 5-tier product ladder catalog + plan-tier ordering."""
from backend.models import PlanTier


def test_plan_catalog_is_five_tier_ladder(client):
    plans = client.get("/api/payments/plans").json()
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
