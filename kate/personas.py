"""Demo personas: synthetic customers with six months of history and scripted life events.

`make seed` loads them into BigQuery + Firestore. Trigger an event from the demo page, or with
`make simulate ARGS="D001 moved_house"`: the transaction goes through Pub/Sub -> kate-engine,
exactly like a real one would.
"""

import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from kate.models import Category, Transaction


@dataclass(frozen=True)
class Recurring:
    counterparty: str
    category: Category
    amount: float  # negative = money out
    day: int  # day within each 30-day period
    channel: str = "direct_debit"
    description: str = ""


@dataclass(frozen=True)
class EventTxn:
    counterparty: str
    category: Category
    amount: float
    country: str = "BE"
    channel: str = "card"
    description: str = ""


@dataclass(frozen=True)
class LifeEvent:
    event_id: str
    label: str
    story: str
    transactions: tuple[EventTxn, ...]


@dataclass(frozen=True)
class Persona:
    customer_id: str
    first_name: str
    last_name: str
    age: int
    language: str
    city: str
    segment: str
    products: tuple[str, ...]
    story: str
    final_balance: float  # balance at the end of the seeded history
    variable_spend: float  # rough monthly spend on groceries, restaurants, transport, shopping
    recurring: tuple[Recurring, ...]
    events: tuple[LifeEvent, ...]

    def event(self, event_id: str) -> LifeEvent | None:
        return next((e for e in self.events if e.event_id == event_id), None)


C = Category

PERSONAS: dict[str, Persona] = {
    p.customer_id: p
    for p in (
        Persona(
            customer_id="D001",
            first_name="Lotte",
            last_name="Peeters",
            age=29,
            language="nl",
            city="Gent",
            segment="young_professional",
            products=("current_account", "credit_card"),
            story="UX designer in Ghent. Rents a flat and has no home insurance with the bank.",
            final_balance=7400.0,
            variable_spend=900.0,
            recurring=(
                Recurring("Studio Nova BV", C.SALARY, 2850.0, 25, "transfer", "Loon"),
                Recurring("Immo Vandenberghe", C.RENT, -950.0, 1, "transfer", "Huur appartement"),
                Recurring("Luminus", C.UTILITIES, -85.0, 5),
                Recurring("Telenet", C.TELECOM, -45.0, 8),
                Recurring("Spotify", C.SUBSCRIPTION, -11.99, 12, "card"),
                Recurring("Netflix", C.SUBSCRIPTION, -13.99, 15, "card"),
            ),
            events=(
                LifeEvent(
                    "moved_house",
                    "Pays rent to a new landlord",
                    "Lotte just moved to a bigger flat near Gent-Dampoort.",
                    (EventTxn("Residentie Dampoort NV", C.RENT, -1150.0, channel="transfer",
                              description="Huur Dampoortstraat 12"),),
                ),
                LifeEvent(
                    "salary_increase",
                    "Gets a raise",
                    "Lotte's promotion shows up in her salary.",
                    (EventTxn("Studio Nova BV", C.SALARY, 3390.0, channel="transfer", description="Loon"),),
                ),
            ),
        ),
        Persona(
            customer_id="D002",
            first_name="Youssef",
            last_name="El Amrani",
            age=34,
            language="fr",
            city="Bruxelles",
            segment="family",
            products=("current_account", "savings_account", "mortgage"),
            story="Engineer in Brussels with a toddler and a second child on the way.",
            final_balance=23500.0,
            variable_spend=1400.0,
            recurring=(
                Recurring("Atelier Lumen SRL", C.SALARY, 3600.0, 25, "transfer", "Salaire"),
                Recurring("Crédit hypothécaire", C.MORTGAGE, -1280.0, 2, "direct_debit", "Remboursement prêt"),
                Recurring("Engie", C.UTILITIES, -140.0, 5),
                Recurring("Proximus", C.TELECOM, -65.0, 8),
                Recurring("Crèche Les Petits Pas", C.EDUCATION, -320.0, 10, "transfer", "Crèche"),
            ),
            events=(
                LifeEvent(
                    "growing_family",
                    "Buys a pram and a crib",
                    "Youssef and his partner are expecting their second child.",
                    (EventTxn("Dreambaby Anderlecht", C.BABY, -389.90),),
                ),
                LifeEvent(
                    "vehicle_purchase",
                    "Buys a family car",
                    "With two kids, the small car no longer fits.",
                    (EventTxn("Garage Van Damme", C.VEHICLE, -16400.0, channel="transfer",
                              description="Acompte Skoda Octavia Combi"),),
                ),
            ),
        ),
        Persona(
            customer_id="D003",
            first_name="Marie",
            last_name="Dubois",
            age=67,
            language="fr",
            city="Namur",
            segment="senior",
            products=("current_account", "savings_account", "home_insurance"),
            story="Retired teacher in Namur who loves city trips.",
            final_balance=3140.0,
            variable_spend=1800.0,
            recurring=(
                Recurring("Service fédéral des Pensions", C.SALARY, 2150.0, 25, "transfer", "Pension"),
                Recurring("Assurance habitation", C.INSURANCE, -48.0, 3),
                Recurring("Engie", C.UTILITIES, -120.0, 5),
                Recurring("Orange Belgium", C.TELECOM, -39.0, 8),
            ),
            events=(
                LifeEvent(
                    "travelling_abroad",
                    "Pays by card in Lisbon",
                    "Marie is on a city trip to Lisbon.",
                    (
                        EventTxn("Pastelaria de Belém", C.RESTAURANTS, -18.40, country="PT"),
                        EventTxn("Hotel Avenida Palace", C.TRAVEL, -412.0, country="PT"),
                    ),
                ),
                LifeEvent(
                    "cashflow_risk",
                    "Pays an unexpected roof repair",
                    "A storm damaged Marie's roof; the repair leaves little room before her fixed costs.",
                    (EventTxn("Toitures Lambert SRL", C.HOME, -2950.0, channel="transfer",
                              description="Réparation toiture"),),
                ),
            ),
        ),
        Persona(
            customer_id="D004",
            first_name="Thomas",
            last_name="Janssens",
            age=23,
            language="en",
            city="Leuven",
            segment="student",
            products=("student_account",),
            story="Just graduated in Leuven and starts his first job. Still lives in his student room.",
            final_balance=1383.0,
            variable_spend=250.0,
            recurring=(
                Recurring("Ouders Janssens", C.TRANSFER_IN, 450.0, 1, "transfer", "Zakgeld"),
                Recurring("Kotbaas Leuven", C.RENT, -460.0, 2, "transfer", "Huur kot"),
                Recurring("Mobile Vikings", C.TELECOM, -20.0, 8),
                Recurring("Spotify", C.SUBSCRIPTION, -11.99, 12, "card"),
            ),
            events=(
                LifeEvent(
                    "first_salary",
                    "Receives his first salary",
                    "Thomas's first real pay check arrives.",
                    (EventTxn("Brightlane NV", C.SALARY, 2450.0, channel="transfer", description="Loon"),),
                ),
                LifeEvent(
                    "cashflow_risk",
                    "Buys a laptop just before rent is due",
                    "Thomas buys a laptop for his new job; rent leaves in a few days.",
                    (EventTxn("Coolblue", C.SHOPPING, -1299.0, description="Laptop"),),
                ),
            ),
        ),
    )
}

MERCHANTS: dict[Category, tuple[str, ...]] = {
    C.GROCERIES: ("Colruyt", "Delhaize", "Aldi", "Lidl", "Carrefour Market", "Albert Heijn"),
    C.RESTAURANTS: ("Le Pain Quotidien", "Exki", "Panos", "Balls & Glory", "Frituur 't Hoekske"),
    C.TRANSPORT: ("NMBS/SNCB", "De Lijn", "STIB-MIVB", "Q8", "TotalEnergies"),
    C.SHOPPING: ("Bol.com", "Zalando", "Hema", "Action", "Standaard Boekhandel", "Fnac"),
}
VARIABLE_MIX = ((C.GROCERIES, 0.45, 5), (C.RESTAURANTS, 0.2, 3), (C.TRANSPORT, 0.15, 3), (C.SHOPPING, 0.2, 2))


def generate_history(persona: Persona, now: datetime, days: int = 180) -> list[Transaction]:
    """Deterministic history; balances are back-calculated so the history ends at final_balance."""
    rng = random.Random(f"kate-{persona.customer_id}")
    start = (now - timedelta(days=days)).replace(hour=8, minute=0, second=0, microsecond=0)
    items: list[tuple] = []
    for period in range(days // 30):
        base = start + timedelta(days=30 * period)
        for r in persona.recurring:
            when = base + timedelta(days=r.day - 1, hours=rng.randint(0, 8))
            items.append((when, r.counterparty, r.category, r.amount, r.channel, r.description))
        for category, share, count in VARIABLE_MIX:
            for _ in range(count):
                amount = -round(persona.variable_spend * share / count * rng.uniform(0.6, 1.4), 2)
                when = base + timedelta(days=rng.randint(0, 29), hours=rng.randint(8, 20), minutes=rng.randint(0, 59))
                items.append((when, rng.choice(MERCHANTS[category]), category, amount, "card", ""))

    items = sorted((i for i in items if i[0] < now - timedelta(hours=2)), key=lambda i: i[0])
    balance = persona.final_balance - sum(i[3] for i in items)
    history = []
    for index, (when, counterparty, category, amount, channel, description) in enumerate(items):
        balance += amount
        history.append(
            Transaction(
                transaction_id=f"seed-{persona.customer_id}-{index:04d}",
                customer_id=persona.customer_id,
                booked_at=when,
                amount=amount,
                counterparty=counterparty,
                category=category,
                channel=channel,
                description=description,
                balance_after=round(balance, 2),
            )
        )
    return history


def build_event_transactions(
    persona: Persona, event: LifeEvent, now: datetime, latest_balance: float | None
) -> list[Transaction]:
    balance = latest_balance
    transactions = []
    for index, e in enumerate(event.transactions):
        if balance is not None:
            balance = round(balance + e.amount, 2)
        transactions.append(
            Transaction(
                transaction_id=f"evt-{persona.customer_id}-{secrets.token_hex(6)}",
                customer_id=persona.customer_id,
                booked_at=now + timedelta(seconds=index),
                amount=e.amount,
                counterparty=e.counterparty,
                category=e.category,
                channel=e.channel,
                country=e.country,
                description=e.description,
                balance_after=balance,
            )
        )
    return transactions


def profile_document(persona: Persona, now: datetime) -> dict:
    """Firestore customers/{id}. demo_epoch hides live transactions from before the last reset."""
    return {
        "customer_id": persona.customer_id,
        "first_name": persona.first_name,
        "last_name": persona.last_name,
        "age": persona.age,
        "language": persona.language,
        "city": persona.city,
        "segment": persona.segment,
        "products": list(persona.products),
        "story": persona.story,
        "consent": {"proactive": True, "voice": True},
        "muted_topics": [],
        "memory": [],
        "demo_epoch": now,
        "created_at": now,
        "updated_at": now,
    }
