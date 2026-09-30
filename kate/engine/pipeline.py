"""transaction -> signals -> contact policy -> Gemini -> nudge (Firestore) + audit trail (BigQuery)."""

import hashlib
from collections.abc import Callable
from datetime import UTC, date, datetime

from kate.engine import policy
from kate.engine.composer import NudgeDraft, compose
from kate.engine.detectors import Signal, detect
from kate.models import NudgeStatus, Transaction
from kate.store import Store, demo_epoch

Composer = Callable[[Signal, Transaction, dict], tuple[NudgeDraft, str]]


def _hash_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def nudge_id_for(customer_id: str, signal_type: str, day: date) -> str:
    # One nudge per customer, signal type and day: redelivered or concurrent events collapse into one.
    return _hash_id(customer_id, signal_type, day.isoformat())


def process_transaction(
    txn: Transaction, store: Store, composer: Composer = compose, now: datetime | None = None
) -> dict:
    now = now or datetime.now(UTC)
    profile = store.get_customer(txn.customer_id)
    history = store.history(txn.customer_id, since=demo_epoch(profile), exclude_transaction_id=txn.transaction_id)
    store.insert_live_transaction(txn)

    signals = detect(txn, history)
    recent = store.nudges_since(txn.customer_id, now - policy.SAME_SIGNAL_COOLDOWN) if signals and profile else []
    outcome: dict = {"transaction_id": txn.transaction_id, "customer_id": txn.customer_id, "signals": []}

    for signal in signals:
        decision = policy.decide(signal, profile, recent, now)
        result = {"signal_type": signal.signal_type, "decision": decision.reason}
        if decision.allowed:
            draft, composer_name = composer(signal, txn, profile)
            if not draft.should_contact:
                result["decision"] = "composer_declined"
            else:
                nudge = {
                    "nudge_id": nudge_id_for(txn.customer_id, signal.signal_type, now.date()),
                    "customer_id": txn.customer_id,
                    "signal_type": signal.signal_type,
                    "topic": signal.topic,
                    "status": NudgeStatus.NEW.value,
                    "created_at": now,
                    "language": profile.get("language", "en"),
                    "title": draft.title,
                    "message": draft.message,
                    "spoken_message": draft.spoken_message,
                    "reason": draft.reason,
                    "suggested_actions": draft.suggested_actions,
                    "product_ids": draft.product_ids,
                    "urgency": draft.urgency,
                    "confidence": signal.confidence,
                    "evidence": signal.evidence,
                    "transaction_id": txn.transaction_id,
                    "composer": composer_name,
                }
                if store.create_nudge(nudge):
                    store.record_nudge_event(nudge, "created", {"composer": composer_name})
                    recent.append(nudge)
                    result["decision"] = "nudged"
                    result["nudge_id"] = nudge["nudge_id"]
                else:
                    result["decision"] = "duplicate"

        store.record_signal({
            "signal_id": _hash_id(txn.transaction_id, signal.signal_type),
            "customer_id": txn.customer_id,
            "signal_type": signal.signal_type,
            "topic": signal.topic,
            "detected_at": now,
            "transaction_id": txn.transaction_id,
            "confidence": signal.confidence,
            "evidence": signal.evidence,
            "decision": result["decision"],
            "source": "stream",
        })
        outcome["signals"].append(result)
    return outcome
