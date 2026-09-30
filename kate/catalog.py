"""Illustrative product and service catalogue for the proof of concept.

NOT real KBC products or conditions. Kate may only mention items from this list, and the
engine only offers the ones that fit the detected signal.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Product:
    product_id: str
    name: str
    summary: str
    fits_signals: tuple[str, ...]
    needs_advisor: bool = False


PRODUCTS: dict[str, Product] = {
    p.product_id: p
    for p in (
        Product(
            "moving_checklist",
            "Moving checklist",
            "In-app checklist: change your address everywhere, move utilities and update your insurance in one go.",
            ("moved_house",),
        ),
        Product(
            "home_insurance",
            "Home insurance",
            "Fire, water damage and theft cover for tenants and owners. Most landlords ask for it.",
            ("moved_house",),
        ),
        Product(
            "savings_goal",
            "Automatic savings goal",
            "Move a fixed amount to savings the day your salary arrives. Pause or change it any time.",
            ("first_salary", "salary_increase"),
        ),
        Product(
            "pension_savings",
            "Pension savings",
            "Long-term pension savings with a yearly tax benefit in Belgium. An advisor explains the options.",
            ("first_salary", "salary_increase"),
            needs_advisor=True,
        ),
        Product(
            "budget_coach",
            "Budget coach",
            "Shows fixed costs and upcoming payments, and warns you before the balance gets too low.",
            ("first_salary", "salary_decrease", "cashflow_risk"),
        ),
        Product(
            "payment_reminder",
            "Upcoming payment alert",
            "A heads-up a few days before rent, loan or utility payments leave your account.",
            ("cashflow_risk", "salary_decrease"),
        ),
        Product(
            "child_savings",
            "Savings account for your child",
            "A savings account in your child's name that family members can contribute to.",
            ("growing_family",),
        ),
        Product(
            "family_protection",
            "Family protection insurance",
            "Life and income protection so your family is covered if something happens to you.",
            ("growing_family",),
            needs_advisor=True,
        ),
        Product(
            "travel_insurance",
            "Travel insurance",
            "Medical assistance, repatriation and luggage cover while abroad.",
            ("travelling_abroad",),
        ),
        Product(
            "card_abroad",
            "Card settings abroad",
            "Check your card limits and geo-blocking for the country you are in, straight from the app.",
            ("travelling_abroad",),
        ),
        Product(
            "car_insurance",
            "Car insurance",
            "Mandatory third-party liability plus optional omnium cover for your new car.",
            ("vehicle_purchase",),
        ),
        Product(
            "car_loan",
            "Car loan",
            "Finance (part of) a car. Rates and approval depend on your situation; an advisor confirms the offer.",
            ("vehicle_purchase",),
            needs_advisor=True,
        ),
    )
}


def products_for(signal_type: str) -> list[Product]:
    return [p for p in PRODUCTS.values() if signal_type in p.fits_signals]
