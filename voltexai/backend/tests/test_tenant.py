"""White-label multi-tenant: default branding, resolution, admin CRUD."""


def test_default_tenant_branding(client):
    d = client.get("/api/tenant").json()
    assert d["slug"] == "voltexai"
    assert d["name"] == "VoltexAI Technologies"
    assert d["accent_color"].startswith("#")
    assert isinstance(d["socials"], list) and d["socials"]


def test_resolve_by_x_tenant_falls_back_to_default(client):
    # unknown tenant header -> still returns the default brand, never errors
    d = client.get("/api/tenant", headers={"X-Tenant": "does-not-exist"}).json()
    assert d["slug"] == "voltexai"


def test_admin_can_create_and_resolve_tenant(client, admin_user, free_user):
    # non-admin is blocked
    assert client.post("/api/tenant", headers=free_user["headers"],
                       json={"slug": "acme", "name": "Acme Markets"}).status_code == 403
    # admin creates a white-label tenant
    r = client.post("/api/tenant", headers=admin_user["headers"], json={
        "slug": "acme", "name": "Acme Markets", "accent_color": "#3366FF",
        "tagline": "Trade with Acme", "socials": [{"id": "x", "label": "X", "url": "https://x.com/acme"}],
    })
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Acme Markets" and r.json()["accent_color"] == "#3366FF"

    # resolves by X-Tenant header now
    d = client.get("/api/tenant", headers={"X-Tenant": "acme"}).json()
    assert d["slug"] == "acme" and d["tagline"] == "Trade with Acme"

    # duplicate slug rejected
    assert client.post("/api/tenant", headers=admin_user["headers"],
                       json={"slug": "acme", "name": "Dup"}).status_code == 400

    # admin can update it
    up = client.put("/api/tenant/acme", headers=admin_user["headers"],
                    json={"tagline": "Acme — trade smarter"})
    assert up.status_code == 200 and up.json()["tagline"] == "Acme — trade smarter"


def test_tenant_list_admin_only(client, admin_user):
    lst = client.get("/api/tenant/all", headers=admin_user["headers"]).json()
    assert any(t["slug"] == "voltexai" for t in lst["tenants"])
