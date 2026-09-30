"""Webhook tools for the ElevenLabs agent (configured in agent/sync.py).

Each request carries two headers that ElevenLabs fills in, never the LLM:
  X-Kate-Tool-Secret  workspace secret -> the call really comes from our agent
  X-Kate-Session      dynamic variable -> which customer this conversation belongs to
Responses are kept small: they go straight into the LLM context.
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from kate.api.common import profile_or_404, respond_to_nudge
from kate.catalog import PRODUCTS
from kate.deps import get_store
from kate.models import Category, Id, Topic
from kate.security import Principal, require_tool_caller
from kate.store import Store, demo_epoch

router = APIRouter(prefix="/tools", tags=["elevenlabs-tools"])


@router.get("/customer-overview")
def customer_overview(p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)) -> dict:
    profile = profile_or_404(store, p.customer_id)
    open_nudges = store.list_nudges(p.customer_id, limit=10, open_only=True)
    return {
        "customer": {k: profile.get(k) for k in ("first_name", "age", "city", "language", "segment", "products")},
        "open_nudges": [
            {"nudge_id": n["nudge_id"], "title": n.get("title"), "message": n.get("message"),
             "reason": n.get("reason"), "product_ids": n.get("product_ids", []), "created_at": n.get("created_at")}
            for n in open_nudges
        ],
        "remembered_preferences": [m.get("note") for m in profile.get("memory", [])][-10:],
        "muted_topics": profile.get("muted_topics", []),
        "today": datetime.now(UTC).date().isoformat(),
    }


class TransactionsQuery(BaseModel):
    days: int = Field(default=30, ge=1, le=180)
    category: Category | None = None
    limit: int = Field(default=10, ge=1, le=25)


@router.post("/recent-transactions")
def recent_transactions(
    body: TransactionsQuery, p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)
) -> dict:
    profile = profile_or_404(store, p.customer_id)
    rows = store.recent_transactions(
        p.customer_id, demo_epoch(profile), body.days, body.limit, body.category.value if body.category else None
    )
    return {
        "transactions": [
            {"date": r["booked_at"].date().isoformat(), "amount_eur": r["amount"], "counterparty": r["counterparty"],
             "category": r["category"], "country": r["country"]}
            for r in rows
        ]
    }


class SpendingQuery(BaseModel):
    days: int = Field(default=30, ge=7, le=180)


@router.post("/spending-summary")
def spending_summary(
    body: SpendingQuery, p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)
) -> dict:
    profile = profile_or_404(store, p.customer_id)
    return store.spending_summary(p.customer_id, demo_epoch(profile), body.days)


class NudgeFeedback(BaseModel):
    nudge_id: Id
    response: Literal["accepted", "dismissed", "snoozed"]
    note: str = Field(default="", max_length=300)


@router.post("/nudge-response")
def nudge_response(
    body: NudgeFeedback, p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)
) -> dict:
    updated = respond_to_nudge(store, p.customer_id, body.nudge_id, body.response, body.note, channel="voice")
    return {"ok": True, "nudge_id": updated["nudge_id"], "status": updated["status"]}


class RememberRequest(BaseModel):
    note: str = Field(min_length=3, max_length=300)
    topic: Topic | None = None
    mute_topic: bool = False


@router.post("/remember")
def remember(body: RememberRequest, p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)) -> dict:
    profile_or_404(store, p.customer_id)
    store.remember(p.customer_id, body.note, body.topic.value if body.topic else None, body.mute_topic)
    return {"ok": True, "muted_topic": body.topic.value if body.mute_topic and body.topic else None}


class ProductQuery(BaseModel):
    product_id: str = Field(pattern=r"^[a-z_]{2,40}$")


@router.post("/product-info")
def product_info(body: ProductQuery, _: Principal = Depends(require_tool_caller)) -> dict:
    product = PRODUCTS.get(body.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown product; valid ids: {', '.join(PRODUCTS)}")
    return {"product_id": product.product_id, "name": product.name, "summary": product.summary,
            "needs_advisor": product.needs_advisor}


class CallbackRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)
    preferred_time: str = Field(default="", max_length=100)
    channel: Literal["phone", "video", "branch"] = "phone"


@router.post("/advisor-callback")
def advisor_callback(
    body: CallbackRequest, p: Principal = Depends(require_tool_caller), store: Store = Depends(get_store)
) -> dict:
    profile_or_404(store, p.customer_id)
    request_id = store.create_callback(p.customer_id, body.model_dump())
    return {"ok": True, "request_id": request_id}
