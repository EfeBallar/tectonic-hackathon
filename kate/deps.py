"""FastAPI dependency providers (overridden with fakes in tests)."""

from functools import lru_cache

from kate.config import get_settings
from kate.events import EventPublisher
from kate.store import Store
from kate.voice import ElevenLabs


@lru_cache
def get_store() -> Store:
    return Store(get_settings())


@lru_cache
def get_voice() -> ElevenLabs:
    return ElevenLabs(get_settings())


@lru_cache
def get_event_publisher() -> EventPublisher:
    return EventPublisher(get_settings())
