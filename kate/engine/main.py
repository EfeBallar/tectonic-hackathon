"""kate-engine: private Cloud Run service. Pub/Sub pushes every transaction here."""

import base64
import binascii
import json
import logging

from fastapi import Depends, FastAPI, Response
from pydantic import BaseModel, Field, ValidationError

from kate.deps import get_store
from kate.engine.pipeline import process_transaction
from kate.logs import setup_logging
from kate.models import Transaction
from kate.security import verify_pubsub_push
from kate.store import Store

setup_logging()
log = logging.getLogger("kate.engine")

app = FastAPI(title="kate-engine", docs_url=None, redoc_url=None, openapi_url=None)


class PushMessage(BaseModel):
    data: str = ""
    message_id: str = Field(default="", alias="messageId")
    attributes: dict[str, str] = Field(default_factory=dict)


class PushEnvelope(BaseModel):
    message: PushMessage
    subscription: str = ""


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/pubsub/transactions", status_code=204, dependencies=[Depends(verify_pubsub_push)])
def on_transaction(envelope: PushEnvelope, store: Store = Depends(get_store)) -> Response:
    try:
        txn = Transaction.model_validate_json(base64.b64decode(envelope.message.data, validate=True))
    except (binascii.Error, ValidationError, ValueError) as exc:
        # Acknowledge poison messages instead of letting Pub/Sub retry them forever.
        log.warning("dropping malformed message %s: %s", envelope.message.message_id, exc)
        return Response(status_code=204)

    # Any exception -> 500 -> Pub/Sub retries with backoff, then dead-letters after 5 attempts.
    outcome = process_transaction(txn, store)
    log.info("processed %s", json.dumps(outcome, default=str))
    return Response(status_code=204)
