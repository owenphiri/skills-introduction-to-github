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


# ----------------------------- receipts -----------------------------
def test_receipt_renders_branded_and_itemized():
    from backend.services import email_service as E
    html = E._receipt_html(
        receipt_no="VXR-20260101-STABC123", date_str="01 Jan 2026, 00:00 UTC",
        buyer_name="Test Trader", buyer_email="t@example.com",
        items=[("SMC Masterclass Bundle", "Course", 149.0)],
        total=149.0, currency="USD", method="Card · Stripe", reference="cs_test_x")
    assert "VoltexAI" in html and "RECEIPT" in html
    assert "VXR-20260101-STABC123" in html
    assert "SMC Masterclass Bundle" in html and "$149.00" in html
    assert "cs_test_x" in html and "PAID" in html


def test_money_formatting():
    from backend.services.email_service import _money
    assert _money(49, "USD") == "$49.00"
    assert _money(300, "ZMW") == "K300.00"
    assert _money(20000, "NGN") == "₦20,000.00"
    assert _money(10, "XYZ") == "10.00 XYZ"  # unknown currency -> code suffix


def test_receipt_number_is_deterministic_shape():
    from backend.routes.payment_routes import _receipt_no
    rn = _receipt_no("stripe", "cs_test_abc123def456")
    assert rn.startswith("VXR-") and "ST" in rn
    assert rn.endswith("DEF456")


def test_send_receipt_email_best_effort_true(monkeypatch):
    # console provider (default in tests) returns True without a real send
    from backend.services import email_service as E
    ok = E.send_receipt_email(
        "buyer@example.com", "Buyer",
        receipt_no="VXR-1", items=[("X", "", 5.0)],
        total=5.0, currency="USD", method="Card · Stripe", reference="r1")
    assert ok is True
