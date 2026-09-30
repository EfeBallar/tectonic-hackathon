"""Real-time signal detectors: one transaction + the customer's recent history -> life moments.

Add a detector by writing a function and decorating it with @detector. The batch equivalent
for the whole customer base lives in sql/batch_signals.sql.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import timedelta

from kate.engine import forecast
from kate.models import SIGNAL_TOPICS, Category, Transaction

HOME_COUNTRY = "BE"
LOW_BALANCE_EUR = 250.0
FIXED_COST_CATEGORIES = {
    Category.RENT.value,
    Category.MORTGAGE.value,
    Category.UTILITIES.value,
    Category.TELECOM.value,
    Category.INSURANCE.value,
}


@dataclass
class Signal:
    signal_type: str
    confidence: float
    evidence: dict = field(default_factory=dict)

    @property
    def topic(self) -> str:
        return SIGNAL_TOPICS[self.signal_type].value


Detector = Callable[[Transaction, list[dict]], Signal | None]
DETECTORS: list[Detector] = []


def detector(fn: Detector) -> Detector:
    DETECTORS.append(fn)
    return fn


def detect(txn: Transaction, history: list[dict]) -> list[Signal]:
    """history = earlier transactions of the same customer (dicts from BigQuery), oldest first."""
    return [signal for fn in DETECTORS if (signal := fn(txn, history)) is not None]


def _of(history: list[dict], *categories: Category) -> list[dict]:
    wanted = {c.value for c in categories}
    return [h for h in history if h["category"] in wanted]


@detector
def moved_house(txn: Transaction, history: list[dict]) -> Signal | None:
    if txn.category != Category.RENT or txn.amount >= 0:
        return None
    previous_landlords = {h["counterparty"] for h in _of(history, Category.RENT)}
    if txn.counterparty in previous_landlords:
        return None
    return Signal(
        "moved_house",
        0.85 if previous_landlords else 0.6,  # first rent ever could also be a first flat
        {"new_landlord": txn.counterparty, "monthly_rent": -txn.amount, "previous_landlords": sorted(previous_landlords)},
    )


@detector
def salary_change(txn: Transaction, history: list[dict]) -> Signal | None:
    if txn.category != Category.SALARY or txn.amount <= 0:
        return None
    previous = [h["amount"] for h in _of(history, Category.SALARY)][-3:]
    if not previous:
        return Signal("first_salary", 0.8, {"employer": txn.counterparty, "salary": txn.amount})
    average = sum(previous) / len(previous)
    change = (txn.amount - average) / average
    if abs(change) < 0.10:
        return None
    return Signal(
        "salary_increase" if change > 0 else "salary_decrease",
        round(min(0.95, 0.6 + abs(change)), 2),
        {"employer": txn.counterparty, "new_salary": txn.amount, "previous_average": round(average, 2),
         "change_pct": round(change * 100, 1)},
    )


@detector
def growing_family(txn: Transaction, history: list[dict]) -> Signal | None:
    if txn.category != Category.BABY or _of(history, Category.BABY):
        return None
    return Signal("growing_family", 0.6, {"merchant": txn.counterparty, "amount": -txn.amount})


@detector
def travelling_abroad(txn: Transaction, history: list[dict]) -> Signal | None:
    if txn.country == HOME_COUNTRY:
        return None
    window_start = txn.booked_at - timedelta(days=14)
    if any(h.get("country") not in (None, HOME_COUNTRY) and h["booked_at"] >= window_start for h in history):
        return None  # already told them about this trip
    return Signal("travelling_abroad", 0.9, {"country": txn.country, "merchant": txn.counterparty})


@detector
def vehicle_purchase(txn: Transaction, history: list[dict]) -> Signal | None:
    if txn.category != Category.VEHICLE or txn.amount > -2000:
        return None
    return Signal("vehicle_purchase", 0.8, {"seller": txn.counterparty, "amount": -txn.amount})


@detector
def cashflow_risk(txn: Transaction, history: list[dict]) -> Signal | None:
    """Money going out while the 30-day forecast dips below zero (or today's balance is already low)."""
    if txn.balance_after is None or txn.amount >= 0:
        return None
    since = txn.booked_at - timedelta(days=30)
    fixed = [h for h in history if h["category"] in FIXED_COST_CATEGORIES and h["amount"] < 0 and h["booked_at"] >= since]
    if not fixed:
        return None
    outlook = forecast.project(txn.balance_after, history, txn.booked_at)
    if txn.balance_after >= LOW_BALANCE_EUR and outlook["first_negative_on"] is None:
        return None
    monthly_fixed = -sum(h["amount"] for h in fixed)
    return Signal(
        "cashflow_risk",
        0.85 if outlook["first_negative_on"] else 0.75,
        {"balance_after": txn.balance_after, "monthly_fixed_costs": round(monthly_fixed, 2),
         "largest_fixed_cost": max(fixed, key=lambda h: -h["amount"])["counterparty"],
         "forecast": {k: v for k, v in outlook.items() if k != "daily_balance"},
         "daily_balance": outlook["daily_balance"]},
    )
