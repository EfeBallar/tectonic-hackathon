"""kate-api: the public edge on Cloud Run.

/api/*    customer app + analyst dashboard (bearer session tokens)
/tools/*  webhook tools called by the ElevenLabs agent during a conversation
/         test console that exercises the whole pipeline (static/index.html)
"""

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi import Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from kate.api import tools
from kate.api.common import profile_or_404, public_nudge, public_profile, respond_to_nudge
from kate.config import Settings, get_settings
from kate.deps import get_event_publisher, get_store, get_voice
from kate.engine import attention
from kate.events import EventPublisher
from kate.logs import setup_logging
from kate.models import Category, Id
from kate.personas import PERSONAS, build_event_transactions
from kate.security import (
    APP_AUDIENCE,
    APP_SESSION_TTL_S,
    VOICE_AUDIENCE,
    VOICE_SESSION_TTL_S,
    Principal,
    RateLimiter,
    client_ip,
    issue_token,
    require_analyst,
    require_customer,
    secrets_equal,
)
from kate.store import Store, demo_epoch
from kate.voice import ElevenLabs, VoiceError

setup_logging()
log = logging.getLogger("kate.api")

STATIC_DIR = Path(__file__).parent / "static"
NudgeIdPath = Annotated[str, PathParam(pattern=r"^[A-Za-z0-9_-]{2,64}$")]

login_limiter = RateLimiter(limit=10, window_s=60)
event_limiter = RateLimiter(limit=10, window_s=60)


def check_config(settings: Settings) -> None:
    """Fail fast on Cloud Run if a secret did not get mounted."""
    required = {
        "SESSION_SIGNING_KEY": settings.session_signing_key,
        "TOOL_SHARED_SECRET": settings.tool_shared_secret,
        "DEMO_ACCESS_CODE": settings.demo_access_code,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"missing configuration: {', '.join(missing)}")
    if len(settings.session_signing_key) < 32:
        raise RuntimeError("SESSION_SIGNING_KEY must be at least 32 characters")


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_config(get_settings())
    yield


_settings = get_settings()
app = FastAPI(
    title="Kate API",
    lifespan=lifespan,
    docs_url="/docs" if _settings.is_local else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _settings.is_local else None,
)
if _settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    if request.url.path.startswith(("/api/", "/tools/")):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(tools.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/", include_in_schema=False)
def console() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


# --- Demo authentication --------------------------------------------------------------------------
# A shared access code + persona picker stands in for the bank's real login (e.g. itsme) in this
# proof of concept. It only opens the synthetic demo personas.


class DemoLogin(BaseModel):
    access_code: str = Field(min_length=1, max_length=200)
    customer_id: Id


class AnalystLogin(BaseModel):
    access_code: str = Field(min_length=1, max_length=200)


def _check_access_code(request: Request, access_code: str, settings: Settings) -> None:
    if not login_limiter.allow(client_ip(request)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many attempts, try again in a minute")
    if not secrets_equal(access_code, settings.demo_access_code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid access code")


@app.post("/api/auth/demo-login")
def demo_login(
    body: DemoLogin, request: Request, settings: Settings = Depends(get_settings), store: Store = Depends(get_store)
) -> dict:
    _check_access_code(request, body.access_code, settings)
    if body.customer_id not in PERSONAS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown demo persona")
    profile = store.get_customer(body.customer_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "persona not seeded yet (run make seed)")
    token = issue_token(settings, body.customer_id, APP_AUDIENCE, APP_SESSION_TTL_S)
    return {"token": token, "expires_in": APP_SESSION_TTL_S, "customer": public_profile(profile)}


@app.post("/api/auth/analyst-login")
def analyst_login(body: AnalystLogin, request: Request, settings: Settings = Depends(get_settings)) -> dict:
    _check_access_code(request, body.access_code, settings)
    token = issue_token(settings, "analyst", APP_AUDIENCE, APP_SESSION_TTL_S, role="analyst")
    return {"token": token, "expires_in": APP_SESSION_TTL_S}


# --- Customer app ------------------------------------------------------------------------------------


@app.get("/api/me")
def me(p: Principal = Depends(require_customer), store: Store = Depends(get_store)) -> dict:
    return public_profile(profile_or_404(store, p.customer_id))


@app.get("/api/transactions")
def transactions(
    days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=50, ge=1, le=200),
    category: Category | None = None,
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
) -> list[dict]:
    profile = profile_or_404(store, p.customer_id)
    return store.recent_transactions(
        p.customer_id, demo_epoch(profile), days, limit, category.value if category else None
    )


@app.get("/api/spending")
def spending(
    days: int = Query(default=30, ge=7, le=180),
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
) -> dict:
    profile = profile_or_404(store, p.customer_id)
    return store.spending_summary(p.customer_id, demo_epoch(profile), days)


@app.get("/api/nudges")
def nudges(p: Principal = Depends(require_customer), store: Store = Depends(get_store)) -> list[dict]:
    return [public_nudge(n) for n in store.list_nudges(p.customer_id, limit=30)]


@app.get("/api/attention")
def attention_state(p: Principal = Depends(require_customer), store: Store = Depends(get_store)) -> dict:
    """Weekly interruption budget and learned relevance per topic; protective moments do not count."""
    profile = profile_or_404(store, p.customer_id)
    now = datetime.now(UTC)
    recent = store.nudges_since(p.customer_id, now - timedelta(days=7))
    budget = int(profile.get("attention_budget") or attention.WEEKLY_BUDGET)
    return {"budget": budget, "used": attention.interruptions_this_week(recent, now),
            "relevance": profile.get("relevance") or {}, "min_priority": attention.MIN_PRIORITY,
            "scoring": {k: {"urgency": u, "cost": c, "protective": k in attention.PROTECTIVE}
                        for k, (u, c) in attention.SCORING.items()}}


class NudgeResponse(BaseModel):
    response: Literal["accepted", "dismissed", "snoozed"]
    note: str = Field(default="", max_length=300)


@app.post("/api/nudges/{nudge_id}/respond")
def respond(
    nudge_id: NudgeIdPath,
    body: NudgeResponse,
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
) -> dict:
    return public_nudge(respond_to_nudge(store, p.customer_id, nudge_id, body.response, body.note, channel="app"))


@app.get("/api/nudges/{nudge_id}/audio")
def nudge_audio(
    nudge_id: NudgeIdPath,
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
    voice: ElevenLabs = Depends(get_voice),
) -> StreamingResponse:
    nudge = store.get_nudge(p.customer_id, nudge_id)
    if nudge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "nudge not found")
    text = (nudge.get("spoken_message") or nudge.get("message") or "")[:600]
    try:
        audio = voice.speech_stream(text)
    except VoiceError as exc:
        log.warning("text-to-speech failed: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "voice unavailable") from exc
    return StreamingResponse(audio, media_type="audio/mpeg")


class VoiceSessionRequest(BaseModel):
    nudge_id: Id | None = None


# Kate's first sentence (the agent's first_message is "{{opening_line}}").
OPENING_LINES = {
    "nl": ("Hoi {name}, met Kate. Waarmee kan ik je helpen?",
           "Hoi {name}, met Kate. Ik wilde je even iets laten weten: {title}. Heb je een minuutje?"),
    "fr": ("Bonjour {name}, c'est Kate. Comment puis-je vous aider ?",
           "Bonjour {name}, c'est Kate. Je voulais vous parler de ceci : {title}. Vous avez une minute ?"),
    "en": ("Hi {name}, it's Kate. How can I help?",
           "Hi {name}, it's Kate. I wanted to follow up on something: {title}. Do you have a minute?"),
}


@app.post("/api/voice/session")
def voice_session(
    body: VoiceSessionRequest,
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
    voice: ElevenLabs = Depends(get_voice),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Everything the browser needs to start a conversation with the private ElevenLabs agent."""
    if not voice.agent_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "voice agent not configured (infra/05_elevenlabs.sh)")
    profile = profile_or_404(store, p.customer_id)
    language = profile.get("language") if profile.get("language") in OPENING_LINES else "en"
    greeting, follow_up = OPENING_LINES[language]
    name = profile.get("first_name", "")
    nudge_context, opening_line = "none", greeting.format(name=name)
    if body.nudge_id:
        nudge = store.get_nudge(p.customer_id, body.nudge_id)
        if nudge is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "nudge not found")
        nudge_context = f"nudge {nudge['nudge_id']}: {nudge.get('title')}. {nudge.get('message')}"[:500]
        opening_line = follow_up.format(name=name, title=nudge.get("title", ""))
    try:
        credentials = voice.conversation_credentials()
    except VoiceError as exc:
        log.warning("could not start voice session: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "voice unavailable") from exc
    return {
        **credentials,
        "language": language,
        "dynamic_variables": {
            # Only valid for /tools (audience kate-voice) and expires after 30 minutes.
            "session_token": issue_token(settings, p.customer_id, VOICE_AUDIENCE, VOICE_SESSION_TTL_S),
            "customer_first_name": name,
            "customer_language": language,
            "nudge_context": nudge_context,
            "opening_line": opening_line,
        },
    }


# --- Demo controls -------------------------------------------------------------------------------------


@app.get("/api/demo/personas")
def personas() -> list[dict]:
    return [
        {
            "customer_id": persona.customer_id,
            "first_name": persona.first_name,
            "age": persona.age,
            "city": persona.city,
            "language": persona.language,
            "story": persona.story,
            "events": [{"event_id": e.event_id, "label": e.label, "story": e.story} for e in persona.events],
        }
        for persona in PERSONAS.values()
    ]


class DemoEvent(BaseModel):
    event_id: Id


@app.post("/api/demo/events", status_code=status.HTTP_202_ACCEPTED)
def trigger_event(
    body: DemoEvent,
    p: Principal = Depends(require_customer),
    store: Store = Depends(get_store),
    publisher: EventPublisher = Depends(get_event_publisher),
) -> dict:
    """Publishes the persona's scripted transactions to Pub/Sub, the same way a real payment would arrive."""
    persona = PERSONAS.get(p.customer_id)
    event = persona.event(body.event_id) if persona else None
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown event for this customer")
    if not event_limiter.allow(p.customer_id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "slow down")
    profile = profile_or_404(store, p.customer_id)
    balance = store.latest_balance(p.customer_id, demo_epoch(profile))
    txns = build_event_transactions(persona, event, datetime.now(UTC), balance)
    message_ids = [publisher.publish(txn, source="demo") for txn in txns]
    return {"event_id": event.event_id, "message_ids": message_ids,
            "transactions": [txn.model_dump(mode="json") for txn in txns]}


@app.post("/api/demo/reset")
def reset_demo(p: Principal = Depends(require_customer), store: Store = Depends(get_store)) -> dict:
    """Forget live events, nudges and memory for this persona so a rehearsal can start over."""
    profile_or_404(store, p.customer_id)
    return {"deleted_nudges": store.reset_demo(p.customer_id)}


# --- Analyst view ----------------------------------------------------------------------------------------


@app.get("/api/analytics/overview")
def analytics_overview(_: Principal = Depends(require_analyst), store: Store = Depends(get_store)) -> dict:
    return store.analytics_overview()
