"""Contact policy: the difference between helpful and annoying.

A signal can only compete for the customer's attention if they agreed to proactive messages,
did not mute the topic and were not contacted about the same thing recently. The weekly budget
and the choice between competing moments live in attention.py. Every decision is written to
BigQuery (signals.decision) so it can be explained.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from kate.engine.detectors import Signal

MIN_CONFIDENCE = 0.5
SAME_SIGNAL_COOLDOWN = timedelta(days=30)


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str


def decide(signal: Signal, profile: dict | None, recent_nudges: list[dict], now: datetime) -> Decision:
    if profile is None:
        return Decision(False, "unknown_customer")
    if not profile.get("consent", {}).get("proactive", False):
        return Decision(False, "no_consent")
    if signal.topic in profile.get("muted_topics", []):
        return Decision(False, "topic_muted")
    if signal.confidence < MIN_CONFIDENCE:
        return Decision(False, "low_confidence")
    if any(n.get("signal_type") == signal.signal_type and n["created_at"] >= now - SAME_SIGNAL_COOLDOWN
           for n in recent_nudges):
        return Decision(False, "cooldown")
    return Decision(True, "ok")
