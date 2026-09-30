"""Runtime configuration from environment variables (plus a local .env when developing).

On Cloud Run everything is injected by infra/04_deploy.sh: plain settings as env vars,
secrets from Secret Manager.
"""

import os
import re
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=os.environ.get("KATE_ENV_FILE", ".env"), extra="ignore")

    env: str = "cloud"  # "local" only exposes the OpenAPI docs; it never relaxes authentication

    gcp_project_id: str = ""
    gcp_region: str = "europe-west1"
    bq_dataset: str = "kate"
    bq_location: str = "europe-west1"
    firestore_database: str = "(default)"
    pubsub_transactions_topic: str = "kate-transactions"

    gemini_model: str = "gemini-3.5-flash"
    gemini_location: str = "eu"
    gemini_thinking_level: str = "low"
    # Set when Vertex AI is not available: Gemini is then called through the Gemini API with this key.
    gemini_api_key: str = ""

    # Secrets (Secret Manager on Cloud Run, .env locally)
    session_signing_key: str = ""
    tool_shared_secret: str = ""
    demo_access_code: str = ""
    elevenlabs_api_key: str = ""

    elevenlabs_api_base: str = "https://api.elevenlabs.io"
    elevenlabs_agent_id: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_tts_model: str = "eleven_multilingual_v2"

    # kate-engine: expected OIDC audience + identity of the Pub/Sub push subscription
    push_audience: str = ""
    push_service_account: str = ""

    cors_allowed_origins: str = ""

    # Project and dataset end up in SQL as identifiers, so only well-formed names are accepted.
    @field_validator("gcp_project_id")
    @classmethod
    def _valid_project_id(cls, value: str) -> str:
        if value and not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", value):
            raise ValueError("GCP_PROJECT_ID is not a valid project id")
        return value

    @field_validator("bq_dataset")
    @classmethod
    def _valid_dataset(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_]{1,1024}", value):
            raise ValueError("BQ_DATASET may only contain letters, digits and underscores")
        return value

    @property
    def is_local(self) -> bool:
        return self.env == "local"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    def table(self, name: str) -> str:
        """Fully qualified table id. Only called with constant table names, never with request input."""
        if not re.fullmatch(r"[a-z_]+", name):
            raise ValueError(f"unexpected table name {name!r}")
        return f"{self.gcp_project_id}.{self.bq_dataset}.{name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
