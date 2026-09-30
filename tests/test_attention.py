from datetime import UTC, datetime, timedelta

from conftest import login, template_composer

from kate.engine import attention
from kate.engine.detectors import Signal
from kate.engine.forecast import project
from kate.engine.pipeline import process_transaction
from kate.models import Category, Transaction

NOW = datetime.now(UTC)
PROFILE = {"consent": {"proactive": True}, "muted_topics": []}
MOVED = Signal("moved_house", 0.85, {})
RAISE = Signal("salary_increase", 0.9, {})
CASH = Signal("cashflow_risk", 0.85, {})
BUSY = [{"signal_type": f"other_{i}", "created_at": NOW - timedelta(days=i)} for i in range(3)]


def test_one_winner_and_reasons_for_the_rest():
    race = attention.race([RAISE, MOVED], PROFILE, [], NOW)
    assert race.winner.signal is MOVED  # 0.55 × 0.85 − 0.1 beats 0.35 × 0.9 − 0.08
    assert [(s.signal.signal_type, d) for s, d in race.outcomes] == [("moved_house", "selected"),
                                                                     ("salary_increase", "outranked")]
    assert race.attention()["runners_up"][0]["decision"] == "outranked"


def test_budget_full_but_protection_is_never_rationed():
    assert attention.race([MOVED], PROFILE, BUSY, NOW).outcomes[0][1] == "budget_full"
    race = attention.race([MOVED, CASH], PROFILE, BUSY, NOW)
    assert race.winner.signal is CASH and race.attention()["used_after"] == 3
    protective_week = [{**n, "attention": {"protective": True}} for n in BUSY]
    assert attention.race([MOVED], PROFILE, protective_week, NOW).winner.signal is MOVED


def test_relevance_is_learned_and_bounded():
    profile = {**PROFILE, "relevance": {"housing": attention.learn(PROFILE, "housing", "dismissed")}}
    assert profile["relevance"]["housing"] == 0.75
    assert attention.score(MOVED, profile).priority < attention.score(MOVED, PROFILE).priority
    for _ in range(10):
        profile["relevance"]["housing"] = attention.learn(profile, "housing", "dismissed")
    assert profile["relevance"]["housing"] == attention.RELEVANCE_MIN
    assert attention.race([MOVED], profile, [], NOW).outcomes[0][1] == "not_worth_it"


def test_pipeline_composes_only_the_winner(store):
    calls = []

    def composer(signal, txn, profile):
        calls.append(signal.signal_type)
        return template_composer(signal, txn, profile)

    # A card payment abroad for a car: two moments in one event, one slot.
    txn = Transaction(transaction_id="evt-D002-car", customer_id="D002", booked_at=NOW, amount=-16400.0,
                      counterparty="Auto Lisboa", category=Category.VEHICLE, country="PT", balance_after=7100.0)
    outcome = process_transaction(txn, store, composer=composer)
    decisions = {s["signal_type"]: s["decision"] for s in outcome["signals"]}
    assert sorted(decisions.values()) == ["nudged", "outranked"]
    assert calls == [next(k for k, v in decisions.items() if v == "nudged")]
    nudge = store.list_nudges("D002")[0]
    assert nudge["attention"]["runners_up"][0]["decision"] == "outranked"


def test_forecast_finds_the_overdraft_before_it_happens(store):
    history = sorted((t for t in store.transactions if t["customer_id"] == "D001"), key=lambda t: t["booked_at"])
    assert project(7400.0, history, NOW)["first_negative_on"] is None
    tight = project(300.0, history, NOW)
    assert tight["first_negative_on"] is not None and tight["lowest_balance"] < 0
    assert len(tight["daily_balance"]) == 30


def test_feedback_updates_relevance_through_the_api(client, store):
    headers = login(client, "D001")
    client.post("/api/demo/events", json={"event_id": "moved_house"}, headers=headers)
    nudge = client.get("/api/nudges", headers=headers).json()[0]
    assert nudge["attention"]["decision"] == "selected"
    before = client.get("/api/attention", headers=headers).json()
    assert before["used"] == 1 and before["budget"] == attention.WEEKLY_BUDGET
    client.post(f"/api/nudges/{nudge['nudge_id']}/respond", json={"response": "dismissed"}, headers=headers)
    assert client.get("/api/attention", headers=headers).json()["relevance"] == {"housing": 0.75}


def test_muting_a_topic_in_the_app_stops_those_moments(client, store):
    headers = login(client, "D001")
    profile = client.post("/api/preferences/topics", json={"topic": "housing", "muted": True}, headers=headers).json()
    assert profile["muted_topics"] == ["housing"]
    client.post("/api/demo/events", json={"event_id": "moved_house"}, headers=headers)
    assert client.get("/api/nudges", headers=headers).json() == []
    assert store.signals[-1]["decision"] == "topic_muted"
    profile = client.post("/api/preferences/topics", json={"topic": "housing", "muted": False}, headers=headers).json()
    assert profile["muted_topics"] == []
    assert client.post("/api/preferences/topics", json={"topic": "gambling", "muted": True}, headers=headers).status_code == 422
