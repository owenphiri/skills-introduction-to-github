"""Signal quality grade, A/A+ board gate, and the AI rationale endpoint."""


def test_signal_has_grade_and_quality(client):
    d = client.get("/api/signals/EURUSD?timeframe=H1").json()
    assert d["grade"] in {"A+", "A", "B", "C"}
    assert 0 <= d["quality"] <= 100


def test_board_is_A_grade_only_by_default(client):
    d = client.get("/api/signals/board/top").json()
    assert d["min_grade"] == "A"          # min_confidence 7 -> A
    # every surfaced signal is A or A+ (nothing weak on the headline board)
    assert all(s["grade"] in {"A", "A+"} for s in d["signals"])


def test_rationale_requires_auth(client):
    assert client.get("/api/signals/EURUSD/rationale").status_code == 401


def test_rationale_falls_back_without_key(client, paid_user):
    r = client.get("/api/signals/EURUSD/rationale?timeframe=H1",
                   headers=paid_user["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    # no ANTHROPIC key in tests -> deterministic fallback, ai flag false
    assert body["ai"] is False
    assert body["rationale"] and len(body["rationale"]) > 20
    assert body["grade"] in {"A+", "A", "B", "C"}
