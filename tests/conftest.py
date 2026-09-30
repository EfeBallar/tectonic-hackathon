"""Test fixtures: in-memory fakes for Firestore/BigQuery, Pub/Sub and ElevenLabs. No cloud access needed."""

import os

os.environ.update({
    "KATE_ENV_FILE": "/nonexistent/.env",  # never read a developer's real .env in tests
    "GCP_PROJECT_ID": "test-project",
    "SESSION_SIGNING_KEY": "test-signing-key-0123456789abcdefghijklmnop",
    "TOOL_SHARED_SECRET": "test-tool-secret-0123456789",
    "DEMO_ACCESS_CODE": "open-sesame",
    "ELEVENLABS_API_KEY": "sk_test",
    "ELEVENLABS_AGENT_ID": "agent_test",
    "PUSH_AUDIENCE": "https://kate-engine.test",
    "PUSH_SERVICE_ACCOUNT": "kate-pubsub-push@test-project.iam.gserviceaccount.com",
})

import copy  # noqa: E402
from datetime import UTC, datetime, timedelta  # noqa: E402

import pytest  # noqa: E402

from kate.engine.composer import template_draft  # noqa: E402
from kate.engine.pipeline import process_transaction  # noqa: E402
from kate.models import OPEN_NUDGE_STATUSES, Transaction  # noqa: E402
from kate.personas import PERSONAS, generate_history, profile_document  # noqa: E402

TOOL_SECRET = os.environ["TOOL_SHARED_SECRET"]
ACCESS_CODE = os.environ["DEMO_ACCESS_CODE"]


def as_row(txn: Transaction, source: str) -> dict:
    """What BigQuery hands back: datetimes as datetime objects, amounts as floats."""
    row = txn.to_row(source)
    row["booked_at"] = txn.booked_at
    row["ingested_at"] = datetime.now(UTC)
    return row


class FakeStore:
    """In-memory stand-in for kate.store.Store (same method signatures)."""

    def __init__(self):
        self.customers: dict[str, dict] = {}
        self.nudges: dict[str, dict[str, dict]] = {}
        self.transactions: list[dict] = []
        self.signals: list[dict] = []
        self.nudge_events: list[tuple[str, str]] = []
        self.callbacks: list[dict] = []

    # customers
    def get_customer(self, customer_id):
        return copy.deepcopy(self.customers.get(customer_id))

    def put_customer(self, profile):
        self.customers[profile["customer_id"]] = copy.deepcopy(profile)

    def remember(self, customer_id, note, topic, mute_topic):
        customer = self.customers[customer_id]
        customer.setdefault("memory", []).append({"note": note, "topic": topic or "", "created_at": datetime.now(UTC)})
        if mute_topic and topic and topic not in customer.setdefault("muted_topics", []):
            customer["muted_topics"].append(topic)

    def reset_demo(self, customer_id):
        self.customers[customer_id]["demo_epoch"] = datetime.now(UTC)
        return self.delete_nudges(customer_id)

    # nudges
    def list_nudges(self, customer_id, limit=20, open_only=False):
        items = sorted(self.nudges.get(customer_id, {}).values(), key=lambda n: n["created_at"], reverse=True)[:limit]
        return [copy.deepcopy(n) for n in items if not open_only or n["status"] in OPEN_NUDGE_STATUSES]

    def nudges_since(self, customer_id, since):
        return [copy.deepcopy(n) for n in self.nudges.get(customer_id, {}).values() if n["created_at"] >= since]

    def get_nudge(self, customer_id, nudge_id):
        return copy.deepcopy(self.nudges.get(customer_id, {}).get(nudge_id))

    def create_nudge(self, nudge):
        bucket = self.nudges.setdefault(nudge["customer_id"], {})
        if nudge["nudge_id"] in bucket:
            return False
        bucket[nudge["nudge_id"]] = copy.deepcopy(nudge)
        return True

    def update_nudge(self, customer_id, nudge_id, fields):
        nudge = self.nudges.get(customer_id, {}).get(nudge_id)
        if nudge is None:
            return None
        nudge.update(fields)
        return copy.deepcopy(nudge)

    def delete_nudges(self, customer_id):
        return len(self.nudges.pop(customer_id, {}))

    def create_callback(self, customer_id, request):
        self.callbacks.append({**request, "customer_id": customer_id})
        return f"callback-{len(self.callbacks)}"

    # transactions
    def _visible(self, customer_id, since):
        return [t for t in self.transactions
                if t["customer_id"] == customer_id and (t["source"] == "seed" or t["ingested_at"] >= since)]

    def recent_transactions(self, customer_id, since, days, limit, category=None):
        cutoff = datetime.now(UTC) - timedelta(days=days)
        rows = [t for t in self._visible(customer_id, since)
                if t["booked_at"] >= cutoff and (category is None or t["category"] == category)]
        return sorted(rows, key=lambda t: t["booked_at"], reverse=True)[:limit]

    def history(self, customer_id, since, exclude_transaction_id, days=200):
        cutoff = datetime.now(UTC) - timedelta(days=days)
        rows = [t for t in self._visible(customer_id, since)
                if t["booked_at"] >= cutoff and t["transaction_id"] != exclude_transaction_id]
        return sorted(rows, key=lambda t: t["booked_at"])

    def spending_summary(self, customer_id, since, days):
        return {"period_days": days, "money_in": 0.0, "money_out": 0.0, "by_category": []}

    def latest_balance(self, customer_id, since):
        rows = sorted(self._visible(customer_id, since), key=lambda t: t["booked_at"])
        return rows[-1]["balance_after"] if rows else None

    def insert_live_transaction(self, txn):
        self.transactions.append(as_row(txn, "live"))

    def record_signal(self, signal):
        self.signals.append(signal)

    def record_nudge_event(self, nudge, event_type, detail=None):
        self.nudge_events.append((nudge["nudge_id"], event_type))

    def analytics_overview(self, hours=24):
        return {"population": None, "live": [], "window_hours": hours}


def template_composer(signal, txn, profile):
    return template_draft(signal), "template"


class FakePublisher:
    """Instead of Pub/Sub: runs the engine pipeline synchronously against the same fake store."""

    def __init__(self, store: FakeStore):
        self.store = store
        self.published: list[Transaction] = []

    def publish(self, txn, source):
        self.published.append(txn)
        process_transaction(txn, self.store, composer=template_composer)
        return f"msg-{len(self.published)}"


class FakeVoice:
    agent_configured = True

    def conversation_credentials(self):
        return {"conversation_token": "webrtc-token", "signed_url": "wss://example.test/signed"}

    def speech_stream(self, text):
        return iter([b"ID3", text.encode()])


@pytest.fixture
def store() -> FakeStore:
    fake = FakeStore()
    now = datetime.now(UTC)
    for persona in PERSONAS.values():
        fake.put_customer(profile_document(persona, now - timedelta(days=1)))
        fake.transactions += [as_row(txn, "seed") for txn in generate_history(persona, now)]
    return fake


@pytest.fixture
def client(store):
    from fastapi.testclient import TestClient

    from kate.api import main
    from kate.deps import get_event_publisher, get_store, get_voice

    publisher = FakePublisher(store)
    main.app.dependency_overrides = {
        get_store: lambda: store,
        get_event_publisher: lambda: publisher,
        get_voice: lambda: FakeVoice(),
    }
    main.login_limiter._hits.clear()
    main.event_limiter._hits.clear()
    with TestClient(main.app) as test_client:
        test_client.publisher = publisher
        yield test_client
    main.app.dependency_overrides = {}


def login(client, customer_id="D001") -> dict:
    response = client.post("/api/auth/demo-login", json={"access_code": ACCESS_CODE, "customer_id": customer_id})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}
