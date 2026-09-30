"""Shared data shapes: the transaction event on the wire (Pub/Sub -> engine -> BigQuery) and the signal vocabulary."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

# Every id that ends up in a Firestore path or BigQuery parameter is restricted to this alphabet.
Id = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{2,64}$")]


class Category(StrEnum):
    SALARY = "salary"
    RENT = "rent"
    MORTGAGE = "mortgage"
    GROCERIES = "groceries"
    UTILITIES = "utilities"
    TELECOM = "telecom"
    SUBSCRIPTION = "subscription"
    RESTAURANTS = "restaurants"
    TRANSPORT = "transport"
    SHOPPING = "shopping"
    HOME = "home"
    BABY = "baby"
    EDUCATION = "education"
    HEALTH = "health"
    INSURANCE = "insurance"
    TRAVEL = "travel"
    VEHICLE = "vehicle"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    OTHER = "other"


class Topic(StrEnum):
    """What a signal is about. Customers can mute a topic ("stop telling me about travel")."""

    HOUSING = "housing"
    INCOME = "income"
    FAMILY = "family"
    TRAVEL = "travel"
    MOBILITY = "mobility"
    CASHFLOW = "cashflow"


class Language(StrEnum):
    NL = "nl"
    FR = "fr"
    EN = "en"


class NudgeStatus(StrEnum):
    NEW = "new"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"
    SNOOZED = "snoozed"


OPEN_NUDGE_STATUSES = {NudgeStatus.NEW.value, NudgeStatus.SNOOZED.value}

SIGNAL_TOPICS: dict[str, Topic] = {
    "moved_house": Topic.HOUSING,
    "first_salary": Topic.INCOME,
    "salary_increase": Topic.INCOME,
    "salary_decrease": Topic.INCOME,
    "growing_family": Topic.FAMILY,
    "travelling_abroad": Topic.TRAVEL,
    "vehicle_purchase": Topic.MOBILITY,
    "cashflow_risk": Topic.CASHFLOW,
}


class Transaction(BaseModel):
    transaction_id: Id
    customer_id: Id
    booked_at: datetime
    amount: float = Field(description="Negative = money leaving the account")
    currency: str = Field(default="EUR", pattern=r"^[A-Z]{3}$")
    counterparty: str = Field(min_length=1, max_length=120)
    category: Category
    channel: str = Field(default="card", max_length=20)
    country: str = Field(default="BE", pattern=r"^[A-Z]{2}$")
    description: str = Field(default="", max_length=200)
    balance_after: float | None = None

    @field_validator("booked_at")
    @classmethod
    def _as_utc(cls, value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    def to_row(self, source: str, ingested_at: datetime | None = None) -> dict:
        """Row for the BigQuery seed_transactions / live_transactions tables."""
        return {
            "transaction_id": self.transaction_id,
            "customer_id": self.customer_id,
            "booked_at": self.booked_at.isoformat(),
            "amount": round(self.amount, 2),
            "currency": self.currency,
            "counterparty": self.counterparty,
            "category": self.category.value,
            "channel": self.channel,
            "country": self.country,
            "description": self.description,
            "balance_after": None if self.balance_after is None else round(self.balance_after, 2),
            "source": source,
            "ingested_at": (ingested_at or datetime.now(UTC)).isoformat(),
        }
