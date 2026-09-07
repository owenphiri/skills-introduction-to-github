"""High-impact news events + news-trading guard."""
from datetime import datetime, timezone

from backend.data import news_events
from backend.services import auto_trader


def test_nfp_is_first_friday_1230():
    now = datetime(2026, 9, 1, 0, 0, tzinfo=timezone.utc)
    rel = news_events.next_occurrence(news_events.EVENTS_BY_CODE["NFP"], now)
    assert rel.weekday() == 4                 # Friday
    assert rel.day <= 7                        # first Friday of the month
    assert (rel.hour, rel.minute) == (12, 30)


def test_monthly_event_never_lands_on_weekend():
    now = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    rel = news_events.next_occurrence(news_events.EVENTS_BY_CODE["CPI"], now)
    assert rel.weekday() < 5                   # Mon–Fri only


def test_live_window_and_high_impact_flag():
    e = news_events.EVENTS_BY_CODE["NFP"]
    now0 = datetime(2026, 9, 1, 0, 0, tzinfo=timezone.utc)
    rel = news_events.next_occurrence(e, now0)
    # exactly at release -> live, and high-impact flag true
    assert news_events._project(e, rel)["live"] is True
    assert news_events.is_high_impact_live(rel) is True
    # a day before release -> not live
    from datetime import timedelta
    assert news_events._project(e, rel - timedelta(days=1))["live"] is False


def test_news_status_shape():
    s = news_events.news_status()
    assert set(["live", "imminent", "next", "upcoming", "general_playbook", "disclaimer"]) <= set(s)
    # upcoming sorted ascending by minutes_to
    mins = [p["minutes_to"] for p in s["upcoming"]]
    assert mins == sorted(mins)
    if s["upcoming"]:
        p = s["upcoming"][0]
        assert "playbook" in p and "instruments" in p and "countdown" in p


def test_news_endpoint(client):
    d = client.get("/api/news").json()
    assert "upcoming" in d and "general_playbook" in d


# ----------------------------- auto-trader news guard -----------------------------
def test_news_guard_pauses_entries(monkeypatch, tmp_path):
    monkeypatch.setattr(auto_trader, "BOOK_PATH", str(tmp_path / "b.json"))
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setattr(news_events, "is_high_impact_live", lambda now=None: True)
    res = auto_trader.run_cycle("synthetics")
    assert res["ran"] is False and "news" in res["reason"].lower()


def test_news_guard_can_be_disabled(monkeypatch, tmp_path):
    monkeypatch.setattr(auto_trader, "BOOK_PATH", str(tmp_path / "b.json"))
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setenv("AUTOTRADE_NEWS_GUARD", "false")
    monkeypatch.setattr(news_events, "is_high_impact_live", lambda now=None: True)
    res = auto_trader.run_cycle("synthetics")
    assert res["ran"] is True                   # guard off -> cycle proceeds
