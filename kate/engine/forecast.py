"""30-day balance forecast: find the overdraft before it happens.

Deterministic, no LLM: recurring payments and the salary land on their usual rhythm, everyday
spending follows the customer's own average. The composer may quote these numbers but never
invents them. Same idea as the offline simulation in web/lib (projection chart on the overdraft card).
"""

from collections import defaultdict
from datetime import datetime, timedelta

RECURRING_CATEGORIES = {"salary", "rent", "mortgage", "utilities", "telecom", "insurance", "subscription"}
ONE_OFF_EUR = 400.0  # a single purchase above this is not "everyday spending"
HORIZON_DAYS = 30


def _schedule(history: list[dict], start: datetime, days: int) -> tuple[list[dict], set[str]]:
    """Expected recurring bookings in the next `days`: same payee, roughly monthly, last amount."""
    rows_by_payee: dict[str, list[dict]] = defaultdict(list)
    for h in history:
        if h["category"] in RECURRING_CATEGORIES and h["booked_at"] >= start - timedelta(days=100):
            rows_by_payee[h["counterparty"]].append(h)
    scheduled, payees = [], set()
    for payee, rows in rows_by_payee.items():
        if len(rows) < 2:
            continue
        rows.sort(key=lambda h: h["booked_at"])
        gaps = sorted((b["booked_at"] - a["booked_at"]).days for a, b in zip(rows, rows[1:]))
        gap = gaps[len(gaps) // 2]
        if not 25 <= gap <= 35:
            continue
        payees.add(payee)
        due = rows[-1]["booked_at"] + timedelta(days=gap)
        while due <= start:
            due += timedelta(days=gap)
        while due <= start + timedelta(days=days):
            scheduled.append({"on": due, "amount": rows[-1]["amount"], "counterparty": payee,
                              "category": rows[-1]["category"]})
            due += timedelta(days=gap)
    return sorted(scheduled, key=lambda s: s["on"]), payees


def project(balance: float, history: list[dict], start: datetime, days: int = HORIZON_DAYS) -> dict:
    scheduled, recurring_payees = _schedule(history, start, days)
    window = [h for h in history
              if start - timedelta(days=60) <= h["booked_at"] < start and h["amount"] < 0
              and h["counterparty"] not in recurring_payees and -h["amount"] <= ONE_OFF_EUR]
    daily_spend = -sum(h["amount"] for h in window) / 60 if window else 0.0

    level, lowest, lowest_on, first_negative = balance, balance, start, None
    path = []
    for d in range(1, days + 1):
        day_end = start + timedelta(days=d)
        level -= daily_spend
        level += sum(s["amount"] for s in scheduled if day_end - timedelta(days=1) < s["on"] <= day_end)
        path.append(round(level, 2))
        if level < lowest:
            lowest, lowest_on = level, day_end
        if level < 0 and first_negative is None:
            first_negative = day_end

    salary = next((s for s in scheduled if s["category"] == "salary"), None)
    cutoff = first_negative or start + timedelta(days=days)
    debits = sorted((s for s in scheduled if s["amount"] < 0 and s["on"] <= cutoff), key=lambda s: s["amount"])[:3]
    return {
        "horizon_days": days,
        "start_balance": round(balance, 2),
        "lowest_balance": round(lowest, 2),
        "lowest_on": lowest_on.date().isoformat(),
        "first_negative_on": first_negative.date().isoformat() if first_negative else None,
        "next_salary_on": salary["on"].date().isoformat() if salary else None,
        "next_salary_amount": round(salary["amount"], 2) if salary else None,
        "daily_spend": round(daily_spend, 2),
        "upcoming_debits": [{"counterparty": s["counterparty"], "amount": round(s["amount"], 2),
                             "on": s["on"].date().isoformat()} for s in debits],
        "daily_balance": path,
    }
