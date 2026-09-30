import base64
import json
from datetime import UTC, datetime
from functools import partial

import pytest
from fastapi.testclient import TestClient

from kate.config import get_settings
from kate.deps import get_store
from kate.engine import main as engine_main
from kate.engine.pipeline import process_transaction

TXN = {"transaction_id": "evt-D001-push", "customer_id": "D001", "booked_at": datetime.now(UTC).isoformat(),
       "amount": -1150.0, "counterparty": "Residentie Dampoort NV", "category": "rent", "balance_after": 6000.0}


def envelope(payload: bytes) -> dict:
    return {"message": {"data": base64.b64encode(payload).decode(), "messageId": "1"}, "subscription": "s"}


@pytest.fixture
def engine(store, monkeypatch):
    def fake_verify(token, request, audience):
        if token != "google-signed":
            raise ValueError("bad token")
        assert audience == get_settings().push_audience
        return {"email": get_settings().push_service_account, "email_verified": True}

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", fake_verify)
    engine_main.app.dependency_overrides = {get_store: lambda: store}
    yield TestClient(engine_main.app)
    engine_main.app.dependency_overrides = {}


def test_push_requires_google_token(engine, store):
    body = envelope(json.dumps(TXN).encode())
    assert engine.post("/pubsub/transactions", json=body).status_code == 401
    assert engine.post("/pubsub/transactions", json=body, headers={"Authorization": "Bearer forged"}).status_code == 401
    assert not any(t["source"] == "live" for t in store.transactions)


def test_push_from_wrong_identity_rejected(engine, monkeypatch):
    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token",
                        lambda *a, **k: {"email": "attacker@evil.test", "email_verified": True})
    response = engine.post("/pubsub/transactions", json=envelope(json.dumps(TXN).encode()),
                           headers={"Authorization": "Bearer google-signed"})
    assert response.status_code == 403


def test_push_processes_transaction(engine, store, monkeypatch):
    from conftest import template_composer

    monkeypatch.setattr(engine_main, "process_transaction", partial(process_transaction, composer=template_composer))
    response = engine.post("/pubsub/transactions", json=envelope(json.dumps(TXN).encode()),
                           headers={"Authorization": "Bearer google-signed"})
    assert response.status_code == 204
    assert [n["signal_type"] for n in store.list_nudges("D001")] == ["moved_house"]


def test_poison_message_is_acknowledged(engine, store):
    response = engine.post("/pubsub/transactions", json=envelope(b"{not json"),
                           headers={"Authorization": "Bearer google-signed"})
    assert response.status_code == 204
    assert not any(t["source"] == "live" for t in store.transactions)
