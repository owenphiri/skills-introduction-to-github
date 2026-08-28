"""Voltex Pay — one-time Store product checkout."""


def test_store_checkout_requires_auth(client):
    r = client.post("/api/payments/store/checkout",
                    json={"product_id": "edu-smc", "provider": "stripe"})
    assert r.status_code == 401


def test_store_checkout_unknown_product(client, paid_user):
    r = client.post("/api/payments/store/checkout", headers=paid_user["headers"],
                    json={"product_id": "nope-404", "provider": "stripe"})
    assert r.status_code == 404


def test_store_checkout_rejects_plans(client, paid_user):
    # subscription plans must go through /pricing, not the one-time store checkout
    r = client.post("/api/payments/store/checkout", headers=paid_user["headers"],
                    json={"product_id": "plan-trader", "provider": "stripe"})
    assert r.status_code == 400


def test_store_checkout_reaches_provider(client, paid_user):
    # real product, but no Stripe key in tests -> reaches the gateway and 502s,
    # proving validation passed and the one-time checkout path is wired.
    r = client.post("/api/payments/store/checkout", headers=paid_user["headers"],
                    json={"product_id": "edu-smc", "provider": "stripe"})
    assert r.status_code == 502
