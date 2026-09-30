from datetime import UTC, datetime, timedelta

from conftest import as_row

from kate.engine.detectors import detect
from kate.models import Category, Transaction
from kate.personas import PERSONAS, generate_history

NOW = datetime.now(UTC)


def history(customer_id: str) -> list[dict]:
    return [as_row(t, "seed") for t in generate_history(PERSONAS[customer_id], NOW)]


def txn(customer_id="D001", **fields) -> Transaction:
    base = {"transaction_id": "t-test-1", "customer_id": customer_id, "booked_at": NOW, "amount": -10.0,
            "counterparty": "Somebody", "category": Category.OTHER, "balance_after": 1000.0}
    return Transaction(**{**base, **fields})


def types(signals) -> set[str]:
    return {s.signal_type for s in signals}


def test_history_is_consistent():
    rows = generate_history(PERSONAS["D001"], NOW)
    assert rows[-1].balance_after == PERSONAS["D001"].final_balance
    assert all(r.booked_at < NOW for r in rows)
    assert min(r.balance_after for r in rows) > 0


def test_moved_house_only_for_a_new_landlord():
    h = history("D001")
    assert types(detect(txn(amount=-1150, counterparty="Residentie Dampoort NV", category=Category.RENT), h)) == {"moved_house"}
    assert types(detect(txn(amount=-950, counterparty="Immo Vandenberghe", category=Category.RENT), h)) == set()


def test_salary_changes():
    h = history("D001")
    raise_ = detect(txn(amount=3390, counterparty="Studio Nova BV", category=Category.SALARY), h)
    assert types(raise_) == {"salary_increase"}
    assert raise_[0].evidence["change_pct"] > 10
    assert types(detect(txn(amount=2900, counterparty="Studio Nova BV", category=Category.SALARY), h)) == set()
    assert types(detect(txn(amount=2000, counterparty="Studio Nova BV", category=Category.SALARY), h)) == {"salary_decrease"}
    first = detect(txn("D004", amount=2450, counterparty="Brightlane NV", category=Category.SALARY), history("D004"))
    assert types(first) == {"first_salary"}


def test_growing_family_first_time_only():
    h = history("D002")
    baby = txn("D002", amount=-389.9, counterparty="Dreambaby", category=Category.BABY)
    assert types(detect(baby, h)) == {"growing_family"}
    assert types(detect(baby, h + [as_row(baby.model_copy(update={"transaction_id": "t-old"}), "live")])) == set()


def test_travelling_abroad_once_per_trip():
    h = history("D003")
    abroad = txn("D003", amount=-18.4, counterparty="Pastelaria", category=Category.RESTAURANTS, country="PT")
    assert types(detect(abroad, h)) == {"travelling_abroad"}
    earlier = abroad.model_copy(update={"transaction_id": "t-earlier", "booked_at": NOW - timedelta(days=2)})
    assert types(detect(abroad, h + [as_row(earlier, "live")])) == set()


def test_vehicle_purchase_threshold():
    h = history("D002")
    assert types(detect(txn("D002", amount=-16400, category=Category.VEHICLE), h)) == {"vehicle_purchase"}
    assert types(detect(txn("D002", amount=-150, category=Category.VEHICLE), h)) == set()


def test_cashflow_risk_needs_low_balance_and_fixed_costs():
    h = history("D004")
    laptop = txn("D004", amount=-1299, counterparty="Coolblue", category=Category.SHOPPING, balance_after=84.0)
    signals = detect(laptop, h)
    assert types(signals) == {"cashflow_risk"}
    assert signals[0].evidence["monthly_fixed_costs"] > 0
    assert types(detect(laptop.model_copy(update={"balance_after": 900.0}), h)) == set()
    assert types(detect(laptop, [])) == set()
