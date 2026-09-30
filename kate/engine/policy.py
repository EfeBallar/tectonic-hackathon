"""Contact policy: the difference between helpful and annoying.

A signal only becomes a nudge if the customer agreed to proactive messages, did not mute the
topic, was not contacted about the same thing recently and has not had too many messages
this week. Every decision is written to BigQuery (signals.decision) so it can be explained.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from kate.engine.detectors import Signal

MIN_CONFIDENCE = 0.5
SAME_SIGNAL_COOLDOWN = timedelta(days=30)
WEEKLY_CAP = 3


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
    if sum(1 for n in recent_nudges if n["created_at"] >= now - timedelta(days=7)) >= WEEKLY_CAP:
        return Decision(False, "weekly_cap")
    return Decision(True, "ok")
