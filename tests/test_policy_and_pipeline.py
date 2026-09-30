from datetime import UTC, datetime, timedelta

from conftest import template_composer

from kate.engine import policy
from kate.engine.composer import NudgeDraft
from kate.engine.detectors import Signal
from kate.engine.pipeline import process_transaction
from kate.models import Category, Transaction

NOW = datetime.now(UTC)
PROFILE = {"consent": {"proactive": True}, "muted_topics": []}
MOVED = Signal("moved_house", 0.85, {})


def test_policy_rules():
    assert policy.decide(MOVED, None, [], NOW).reason == "unknown_customer"
    assert policy.decide(MOVED, {"consent": {"proactive": False}}, [], NOW).reason == "no_consent"
    assert policy.decide(MOVED, {**PROFILE, "muted_topics": ["housing"]}, [], NOW).reason == "topic_muted"
    assert policy.decide(Signal("moved_house", 0.2, {}), PROFILE, [], NOW).reason == "low_confidence"
    recent_same = [{"signal_type": "moved_house", "created_at": NOW - timedelta(days=3)}]
    assert policy.decide(MOVED, PROFILE, recent_same, NOW).reason == "cooldown"
    busy_week = [{"signal_type": f"other_{i}", "created_at": NOW - timedelta(days=i)} for i in range(3)]
    assert policy.decide(MOVED, PROFILE, busy_week, NOW).reason == "weekly_cap"
    assert policy.decide(MOVED, PROFILE, [], NOW).allowed


def rent_to_new_landlord() -> Transaction:
    return Transaction(transaction_id="evt-D001-abc", customer_id="D001", booked_at=NOW, amount=-1150.0,
                       counterparty="Residentie Dampoort NV", category=Category.RENT, balance_after=6250.0)


def test_pipeline_creates_one_nudge_even_on_redelivery(store):
    txn = rent_to_new_landlord()
    first = process_transaction(txn, store, composer=template_composer)
    assert first["signals"] == [{"signal_type": "moved_house", "decision": "nudged", "nudge_id": first["signals"][0]["nudge_id"]}]
    second = process_transaction(txn, store, composer=template_composer)  # Pub/Sub redelivery
    assert second["signals"][0]["decision"] in ("cooldown", "duplicate")
    assert len(store.list_nudges("D001")) == 1
    assert [s["decision"] for s in store.signals] == ["nudged", second["signals"][0]["decision"]]
    assert store.nudge_events == [(first["signals"][0]["nudge_id"], "created")]


def test_pipeline_respects_composer_veto(store):
    def cautious(signal, txn, profile):
        draft = NudgeDraft(should_contact=False, title="", message="", spoken_message="", reason="",
                           suggested_actions=[], product_ids=[], urgency="low")
        return draft, "test"

    outcome = process_transaction(rent_to_new_landlord(), store, composer=cautious)
    assert outcome["signals"][0]["decision"] == "composer_declined"
    assert store.list_nudges("D001") == []


def test_pipeline_unknown_customer_records_signal_without_contact(store):
    txn = rent_to_new_landlord().model_copy(update={"customer_id": "P00000001"})
    outcome = process_transaction(txn, store, composer=template_composer)
    assert outcome["signals"][0]["decision"] == "unknown_customer"
    assert store.nudges == {}
