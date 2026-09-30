"""kate-api without the cloud, for frontend work: in-memory data, synchronous engine, template wording.

    .venv/bin/python -m kate.ops.offline        # http://localhost:8080, access code: open-sesame

Uses the same fakes as the unit tests (tests/conftest.py), so it needs requirements-dev.txt. Voice is a
stand-in (no ElevenLabs key); audio and conversations only work against the real kate-api on Cloud Run.
Never deployed: the real service is built by `make up` / `make deploy`.
"""

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests"))

import conftest  # noqa: E402  (sets a throwaway local configuration before kate.config is read)
import uvicorn  # noqa: E402

from kate.api import main  # noqa: E402
from kate.deps import get_event_publisher, get_store, get_voice  # noqa: E402
from kate.personas import PERSONAS, generate_history, profile_document  # noqa: E402


class OfflineVoice(conftest.FakeVoice):
    agent_configured = False  # /api/voice/session answers 503, like a cloud deployment without an agent

    def speech_stream(self, text):
        raise main.VoiceError("offline mode has no ElevenLabs key")


def build_store() -> conftest.FakeStore:
    store = conftest.FakeStore()
    now = datetime.now(UTC)
    for persona in PERSONAS.values():
        store.put_customer(profile_document(persona, now - timedelta(days=1)))
        store.transactions += [conftest.as_row(txn, "seed") for txn in generate_history(persona, now)]
    return store


def run(port: int = 8080) -> None:
    store = build_store()
    publisher = conftest.FakePublisher(store)
    main.app.dependency_overrides = {
        get_store: lambda: store,
        get_event_publisher: lambda: publisher,
        get_voice: lambda: OfflineVoice(),
    }
    print(f"offline kate-api on http://localhost:{port}  access code: {conftest.ACCESS_CODE}")
    uvicorn.run(main.app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 8080)
