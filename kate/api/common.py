"""Helpers shared by the app endpoints and the ElevenLabs tools."""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException, status

from kate.engine import attention
from kate.store import Store

log = logging.getLogger("kate.api")

PROFILE_FIELDS = ("customer_id", "first_name", "last_name", "age", "language", "city", "segment", "products",
                  "consent", "muted_topics", "relevance", "attention_budget")
NUDGE_FIELDS = ("nudge_id", "signal_type", "topic", "status", "created_at", "language", "title", "message",
                "reason", "suggested_actions", "product_ids", "urgency", "evidence", "attention")


def profile_or_404(store: Store, customer_id: str) -> dict:
    profile = store.get_customer(customer_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    return profile


def public_profile(profile: dict) -> dict:
    return {k: profile.get(k) for k in PROFILE_FIELDS}


def public_nudge(nudge: dict) -> dict:
    return {k: nudge.get(k) for k in NUDGE_FIELDS}


def respond_to_nudge(store: Store, customer_id: str, nudge_id: str, response: str, note: str, channel: str) -> dict:
    """The nudge is looked up under the caller's own customer document, so other customers' ids just 404."""
    updated = store.update_nudge(
        customer_id,
        nudge_id,
        {"status": response, "responded_at": datetime.now(UTC), "response_note": note, "response_channel": channel},
    )
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "nudge not found")
    try:
        store.record_nudge_event(updated, response, {"channel": channel, "note": note})
    except Exception:  # analytics must never break the customer flow
        log.exception("could not record nudge event")
    # Personalization: an accepted topic scores higher next time, a dismissed one lower.
    topic = updated.get("topic")
    if topic:
        store.set_relevance(customer_id, topic, attention.learn(store.get_customer(customer_id), topic, response))
    return updated
