"""Authentication for the three kinds of callers.

1. The customer app   -> short-lived HS256 session token (audience "kate-app").
2. The ElevenLabs agent (webhook tools)
                      -> shared secret header proves the call comes from *our* agent, plus a
                         per-conversation token (audience "kate-voice") that our backend hands to
                         the voice session as a dynamic variable. ElevenLabs injects it into the
                         tool headers, so the LLM never chooses whose data it reads (no IDOR).
3. Pub/Sub push       -> Google-signed OIDC token for the push service account (kate-engine).

The customer id always comes from a verified token, never from a request parameter.
"""

import hmac
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, Request, status

from kate.config import Settings, get_settings

ISSUER = "kate-api"
APP_AUDIENCE = "kate-app"
VOICE_AUDIENCE = "kate-voice"
APP_SESSION_TTL_S = 8 * 3600
VOICE_SESSION_TTL_S = 30 * 60
ROLES = ("customer", "analyst")


@dataclass(frozen=True)
class Principal:
    customer_id: str
    role: str


def _signing_key(settings: Settings) -> bytes:
    if len(settings.session_signing_key) < 32:
        raise RuntimeError("SESSION_SIGNING_KEY is missing or shorter than 32 characters")
    return settings.session_signing_key.encode()


def issue_token(settings: Settings, subject: str, audience: str, ttl_s: int, role: str = "customer") -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": audience,
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + ttl_s,
        "jti": secrets.token_urlsafe(8),
    }
    return jwt.encode(claims, _signing_key(settings), algorithm="HS256")


def verify_token(settings: Settings, token: str, audience: str) -> Principal:
    try:
        claims = jwt.decode(
            token,
            _signing_key(settings),
            algorithms=["HS256"],  # pinned: never trust the alg header
            audience=audience,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
            leeway=10,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired session") from exc
    if claims.get("role") not in ROLES:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid session")
    return Principal(customer_id=claims["sub"], role=claims["role"])


def secrets_equal(provided: str, expected: str) -> bool:
    """Constant-time comparison that also refuses empty secrets (a missing config must never match)."""
    if not provided or not expected:
        return False
    return hmac.compare_digest(provided.encode(), expected.encode())


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "missing bearer token", headers={"WWW-Authenticate": "Bearer"}
        )
    return authorization.removeprefix("Bearer ").strip()


# --- FastAPI dependencies ----------------------------------------------------------------------


def current_principal(
    authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)
) -> Principal:
    return verify_token(settings, _bearer(authorization), APP_AUDIENCE)


def require_customer(principal: Principal = Depends(current_principal)) -> Principal:
    if principal.role != "customer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "customer session required")
    return principal


def require_analyst(principal: Principal = Depends(current_principal)) -> Principal:
    if principal.role != "analyst":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "analyst session required")
    return principal


def require_tool_caller(
    x_kate_tool_secret: str | None = Header(default=None),
    x_kate_session: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Principal:
    if not secrets_equal(x_kate_tool_secret or "", settings.tool_shared_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown caller")
    if not x_kate_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing conversation session")
    principal = verify_token(settings, x_kate_session, VOICE_AUDIENCE)
    if principal.role != "customer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "customer conversation required")
    return principal


@lru_cache
def _google_request():
    from google.auth.transport import requests as google_requests

    return google_requests.Request()


def verify_pubsub_push(
    authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)
) -> None:
    """Defense in depth for kate-engine: Cloud Run IAM already checks the caller, we check again."""
    token = _bearer(authorization)
    if not settings.push_audience or not settings.push_service_account:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "push authentication not configured")

    from google.oauth2 import id_token

    try:
        claims = id_token.verify_oauth2_token(token, _google_request(), audience=settings.push_audience)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid push token") from exc
    if claims.get("email") != settings.push_service_account or not claims.get("email_verified"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "unexpected push identity")


# --- Brute-force protection ---------------------------------------------------------------------


class RateLimiter:
    """Sliding-window limiter, per instance. Enough to stop guessing the demo access code."""

    def __init__(self, limit: int, window_s: float):
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 10_000:
                self._hits = {k: q for k, q in self._hits.items() if q and now - q[-1] < self.window_s}
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True


def client_ip(request: Request) -> str:
    # Cloud Run's front end appends the real client address as the *last* X-Forwarded-For hop;
    # earlier hops are client-controlled and must not be trusted.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"
