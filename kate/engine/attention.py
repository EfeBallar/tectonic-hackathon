"""Attention budget: the moments Kate could bring up compete for one slot.

    priority = urgency × confidence × relevance(this customer, this topic) − interruption cost

Only the winner is written up, so Gemini runs at most once per event; the other moments are
recorded with the reason they lost. Each customer gets WEEKLY_BUDGET ordinary interruptions a
week. Protective moments (money about to run out) bypass it: protection is never rationed.
Relevance is learned from the customer's own answers, per topic.

Same semantics as web/lib/orchestrator.ts, which runs the offline simulation and the 2.3M pass.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from kate.engine.detectors import Signal

WEEKLY_BUDGET = 3
MIN_PRIORITY = 0.08

# signal type: (urgency = how bad is waiting, cost = what this interruption costs the customer), both 0..1
SCORING: dict[str, tuple[float, float]] = {
    "cashflow_risk": (0.8, 0.05),
    "salary_decrease": (0.55, 0.08),
    "moved_house": (0.55, 0.1),
    "travelling_abroad": (0.5, 0.08),
    "first_salary": (0.5, 0.1),
    "growing_family": (0.45, 0.12),
    "vehicle_purchase": (0.4, 0.1),
    "salary_increase": (0.35, 0.08),
}
PROTECTIVE = {"cashflow_risk"}

RELEVANCE_STEP = {"accepted": 0.15, "snoozed": -0.05, "dismissed": -0.25}
RELEVANCE_MIN, RELEVANCE_MAX = 0.2, 1.5


def relevance(profile: dict | None, topic: str) -> float:
    return float(((profile or {}).get("relevance") or {}).get(topic, 1.0))


def learn(profile: dict | None, topic: str, response: str) -> float:
    """New relevance for a topic after the customer answered a nudge about it."""
    value = relevance(profile, topic) + RELEVANCE_STEP.get(response, 0.0)
    return round(min(RELEVANCE_MAX, max(RELEVANCE_MIN, value)), 3)


@dataclass(frozen=True)
class Scored:
    signal: Signal
    urgency: float
    relevance: float
    cost: float
    priority: float
    protective: bool

    def summary(self, decision: str) -> dict:
        return {"signal_type": self.signal.signal_type, "topic": self.signal.topic, "decision": decision,
                "priority": self.priority, "urgency": self.urgency, "confidence": self.signal.confidence,
                "relevance": self.relevance, "cost": self.cost, "protective": self.protective}


def score(signal: Signal, profile: dict | None) -> Scored:
    urgency, cost = SCORING.get(signal.signal_type, (0.3, 0.1))
    rel = relevance(profile, signal.topic)
    return Scored(signal, urgency, rel, cost, round(urgency * signal.confidence * rel - cost, 3),
                  signal.signal_type in PROTECTIVE)


def interruptions_this_week(recent_nudges: list[dict], now: datetime) -> int:
    """Ordinary interruptions actually delivered in the last 7 days; protective ones are free."""
    return sum(1 for n in recent_nudges
               if n["created_at"] >= now - timedelta(days=7) and not (n.get("attention") or {}).get("protective"))


@dataclass
class Race:
    winner: Scored | None
    outcomes: list[tuple[Scored, str]]
    used: int
    budget: int

    def attention(self) -> dict:
        """Stored on the winning nudge: why it won, what it beat, and what the budget looks like."""
        assert self.winner is not None
        return {**self.winner.summary("selected"), "budget": self.budget,
                "used_before": self.used, "used_after": self.used + (0 if self.winner.protective else 1),
                "runners_up": [s.summary(d) for s, d in self.outcomes if s is not self.winner]}


def race(candidates: list[Signal], profile: dict | None, recent_nudges: list[dict], now: datetime,
         budget: int | None = None) -> Race:
    budget = int((profile or {}).get("attention_budget") or WEEKLY_BUDGET) if budget is None else budget
    used = interruptions_this_week(recent_nudges, now)
    ranked = sorted((score(s, profile) for s in candidates), key=lambda s: (not s.protective, -s.priority))
    winner, outcomes = None, []
    for s in ranked:
        if winner is not None:
            outcomes.append((s, "outranked"))
        elif s.protective:
            winner = s
            outcomes.append((s, "selected"))
        elif s.priority < MIN_PRIORITY:
            outcomes.append((s, "not_worth_it"))
        elif used >= budget:
            outcomes.append((s, "budget_full"))
        else:
            winner = s
            outcomes.append((s, "selected"))
    return Race(winner, outcomes, used, budget)
