"""Pricing — 5-tier product ladder catalog + plan-tier ordering."""
from backend.models import PlanTier
from backend.services import pricing_service


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


def test_period_pricing_math():
    """month / quarter / semiannual / year each discount off the monthly rate."""
    # discounts: month 0%, quarter 5%, semiannual 10%, year = 2 months free (~17%)
    assert pricing_service.period_discount_pct("month") == 0
    assert pricing_service.period_discount_pct("quarter") == 5
    assert pricing_service.period_discount_pct("semiannual") == 10
    assert pricing_service.period_discount_pct("year") == 17

    # trader = $49/mo
    assert pricing_service.period_price_usd("trader", "month") == 49
    assert pricing_service.period_price_usd("trader", "quarter") == 139.65   # 49*3*0.95
    assert pricing_service.period_price_usd("trader", "semiannual") == 264.6  # 49*6*0.90
    assert pricing_service.period_price_usd("trader", "year") == 490          # 49*10

    # per-month equivalent falls as the commitment grows
    eq = [pricing_service.period_monthly_equiv("trader", i)
          for i in ("month", "quarter", "semiannual", "year")]
    assert eq == sorted(eq, reverse=True) and len(set(eq)) == 4

    # savings vs paying the monthly rate for the same months
    assert pricing_service.period_savings_usd("trader", "month") == 0
    assert pricing_service.period_savings_usd("trader", "quarter") == 7.35    # 147-139.65
    assert pricing_service.period_savings_usd("trader", "year") == 98         # 49*2

    # grant length per period
    assert [pricing_service.period_days(i) for i in
            ("month", "quarter", "semiannual", "year")] == [30, 91, 182, 365]

    # free stays free on every period
    for i in pricing_service.VALID_INTERVALS:
        assert pricing_service.period_price_usd("free", i) == 0


def test_plans_expose_period_catalog(client):
    body = client.get("/api/payments/plans").json()
    # catalog-level periods present on billing + top level
    assert [p["interval"] for p in body["periods"]] == \
        ["month", "quarter", "semiannual", "year"]
    assert body["billing"]["periods"][1]["discount_pct"] == 5

    by_id = {p["id"]: p for p in body["plans"]}
    tr = {o["interval"]: o for o in by_id["trader"]["periods"]}
    assert set(tr) == {"month", "quarter", "semiannual", "year"}
    assert tr["semiannual"]["usd_total"] == 264.6
    assert tr["semiannual"]["discount_pct"] == 10
    assert tr["quarter"]["savings_usd"] == 7.35
    # per-month equivalent is strictly cheaper the longer you commit
    eq = [tr[i]["usd_monthly_equiv"] for i in ("month", "quarter", "semiannual", "year")]
    assert eq == sorted(eq, reverse=True)
    # free carries zeros across the board
    for o in by_id["free"]["periods"]:
        assert o["usd_total"] == 0 and o["savings_usd"] == 0


def test_checkout_accepts_all_periods(client, paid_user):
    # each of the four periods passes request validation and reaches the service
    for interval in ("month", "quarter", "semiannual", "year"):
        r = client.post("/api/payments/stripe/checkout",
                        headers=paid_user["headers"],
                        json={"plan": "pro", "interval": interval})
        assert r.status_code == 502, interval
    # a bogus interval is rejected by request validation (422)
    bad = client.post("/api/payments/stripe/checkout",
                      headers=paid_user["headers"], json={"plan": "pro", "interval": "weekly"})
    assert bad.status_code == 422


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
