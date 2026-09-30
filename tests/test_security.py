import time

import jwt
import pytest
from fastapi import HTTPException

from kate.config import get_settings
from kate.security import APP_AUDIENCE, ISSUER, VOICE_AUDIENCE, RateLimiter, issue_token, secrets_equal, verify_token


def test_token_roundtrip():
    settings = get_settings()
    token = issue_token(settings, "D001", APP_AUDIENCE, 60)
    principal = verify_token(settings, token, APP_AUDIENCE)
    assert principal.customer_id == "D001"
    assert principal.role == "customer"


def test_voice_token_is_not_an_app_session():
    settings = get_settings()
    token = issue_token(settings, "D001", VOICE_AUDIENCE, 60)
    with pytest.raises(HTTPException) as exc:
        verify_token(settings, token, APP_AUDIENCE)
    assert exc.value.status_code == 401


def test_expired_token_rejected():
    settings = get_settings()
    token = issue_token(settings, "D001", APP_AUDIENCE, -60)
    with pytest.raises(HTTPException):
        verify_token(settings, token, APP_AUDIENCE)


def test_forged_tokens_rejected():
    settings = get_settings()
    now = int(time.time())
    claims = {"iss": ISSUER, "aud": APP_AUDIENCE, "sub": "D002", "role": "customer", "iat": now, "exp": now + 60}
    wrong_key = jwt.encode(claims, "another-key-that-is-long-enough-000000", algorithm="HS256")
    unsigned = jwt.encode(claims, None, algorithm="none")
    for token in (wrong_key, unsigned, "not-a-jwt"):
        with pytest.raises(HTTPException):
            verify_token(settings, token, APP_AUDIENCE)


def test_unknown_role_rejected():
    settings = get_settings()
    token = issue_token(settings, "D001", APP_AUDIENCE, 60, role="admin")
    with pytest.raises(HTTPException):
        verify_token(settings, token, APP_AUDIENCE)


def test_empty_secrets_never_match():
    assert not secrets_equal("", "")
    assert not secrets_equal("x", "")
    assert secrets_equal("abc", "abc")


def test_rate_limiter():
    limiter = RateLimiter(limit=2, window_s=60)
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    assert limiter.allow("other-ip")
