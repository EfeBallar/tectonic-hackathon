"""Kate on the ElevenLabs Agents Platform, as code. Creates or updates, by name:

  1. workspace secret  kate_tool_shared_secret  (sent as X-Kate-Tool-Secret on every tool call)
  2. webhook tools     kate_*                   (point at kate-api /tools/*)
  3. the agent         Kate (Tectonic hackathon)

    python -m agent.sync                 # push; prints the agent id on stdout
    python -m agent.sync --dry-run       # print the payloads, call nothing
    python -m agent.sync --list-voices   # pick a voice for ELEVENLABS_VOICE_ID

Needs ELEVENLABS_API_KEY, KATE_API_URL and TOOL_SHARED_SECRET (infra/05_elevenlabs.sh sets them).
"""

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

from kate.catalog import PRODUCTS
from kate.models import Category, Topic

API_BASE = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io")
AGENT_NAME = os.environ.get("ELEVENLABS_AGENT_NAME", "Kate (Tectonic hackathon)")
SECRET_NAME = "kate_tool_shared_secret"
PROMPT = (Path(__file__).parent / "prompt.md").read_text()
DEFAULT_LANGUAGE = "nl"
EXTRA_LANGUAGES = ("fr", "en")

# Filled in per conversation by kate-api (/api/voice/session). Placeholders are only used when you
# test in the ElevenLabs dashboard; tools will answer 401 there because the session token is fake.
PLACEHOLDERS = {
    "customer_first_name": "Lotte",
    "customer_language": "nl",
    "nudge_context": "none",
    "opening_line": "Hoi Lotte, met Kate. Waarmee kan ik je helpen?",
    "session_token": "dashboard-test",
}


def log(message: str) -> None:
    print(message, file=sys.stderr)


def tool_payloads(api_url: str, secret_id: str) -> list[dict]:
    # Both headers are filled in by ElevenLabs, never by the LLM: the secret proves the caller,
    # the session token (a dynamic variable) says whose conversation it is.
    headers = {
        "X-Kate-Tool-Secret": {"secret_id": secret_id},
        "X-Kate-Session": {"variable_name": "session_token"},
    }

    def tool(name: str, description: str, path: str, properties: dict | None = None,
             required: list[str] | None = None, method: str = "POST") -> dict:
        api_schema: dict = {"url": f"{api_url}/tools/{path}", "method": method, "request_headers": headers}
        if properties is not None:
            api_schema["request_body_schema"] = {
                "type": "object",
                "properties": properties,
                "required": required or [],
            }
            api_schema["content_type"] = "application/json"
        return {"tool_config": {"type": "webhook", "name": name, "description": description,
                                "response_timeout_secs": 10, "api_schema": api_schema}}

    return [
        tool("kate_customer_overview",
             "Profile of the customer, the open proactive messages Kate sent them (each with a nudge_id) and "
             "preferences Kate remembered. Call once at the start of every conversation.",
             "customer-overview", method="GET"),
        tool("kate_recent_transactions",
             "The customer's recent transactions, newest first. Use for questions about specific payments.",
             "recent-transactions",
             {"days": {"type": "integer", "description": "How many days back to look, 1 to 180. Default 30."},
              "category": {"type": "string", "enum": [c.value for c in Category],
                           "description": "Only this category. Leave out for all categories."},
              "limit": {"type": "integer", "description": "Maximum number of transactions, 1 to 25. Default 10."}}),
        tool("kate_spending_summary",
             "Money in and out per category over the last N days, next to the N days before. "
             "Use for totals and comparisons.",
             "spending-summary",
             {"days": {"type": "integer", "description": "Period length in days, 7 to 180. Default 30."}}),
        tool("kate_nudge_response",
             "Record how the customer reacted to one of Kate's proactive messages.",
             "nudge-response",
             {"nudge_id": {"type": "string", "description": "nudge_id from kate_customer_overview"},
              "response": {"type": "string", "enum": ["accepted", "dismissed", "snoozed"],
                           "description": "accepted = wants to act on it, dismissed = not interested, snoozed = later"},
              "note": {"type": "string", "description": "Optional short reason in the customer's words"}},
             required=["nudge_id", "response"]),
        tool("kate_remember",
             "Save a preference the customer shared so Kate remembers it next time. Set mute_topic to true "
             "when the customer wants no more proactive messages about that topic.",
             "remember",
             {"note": {"type": "string", "description": "The preference in one short sentence"},
              "topic": {"type": "string", "enum": [t.value for t in Topic],
                        "description": "Topic the preference is about, if any"},
              "mute_topic": {"type": "boolean", "description": "true to stop proactive messages about this topic"}},
             required=["note"]),
        tool("kate_product_info",
             "Description of a product or service. Call it before talking about any product.",
             "product-info",
             {"product_id": {"type": "string", "enum": list(PRODUCTS), "description": "Product id"}},
             required=["product_id"]),
        tool("kate_advisor_callback",
             "Book a callback from a human advisor for things Kate cannot do: credit, investments, contracts, "
             "complaints, anything that needs a person.",
             "advisor-callback",
             {"topic": {"type": "string", "description": "What the advisor should help with, one sentence"},
              "preferred_time": {"type": "string", "description": "When the customer wants to be contacted, in their words"},
              "channel": {"type": "string", "enum": ["phone", "video", "branch"], "description": "How the customer wants to talk"}},
             required=["topic"]),
    ]


def agent_payload(tool_ids: list[str]) -> dict:
    first_message = "{{opening_line}}"  # written by kate-api in the customer's language
    return {
        "name": AGENT_NAME,
        "tags": ["kate", "tectonic"],
        "conversation_config": {
            "agent": {
                "first_message": first_message,
                "language": DEFAULT_LANGUAGE,
                "dynamic_variables": {"dynamic_variable_placeholders": PLACEHOLDERS},
                "prompt": {
                    "prompt": PROMPT,
                    "llm": os.environ.get("ELEVENLABS_AGENT_LLM", "gemini-3.5-flash"),
                    "temperature": 0.3,
                    "tool_ids": tool_ids,
                    "built_in_tools": {
                        "end_call": {"type": "system", "name": "end_call", "description": "",
                                     "params": {"system_tool_type": "end_call"}},
                        "language_detection": {"type": "system", "name": "language_detection", "description": "",
                                               "params": {"system_tool_type": "language_detection"}},
                    },
                    "timezone": "Europe/Brussels",
                },
            },
            "tts": {
                # Dutch and French need a multilingual v2.5 model
                "model_id": os.environ.get("ELEVENLABS_AGENT_TTS_MODEL", "eleven_flash_v2_5"),
                "voice_id": os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
            },
            "asr": {"keywords": ["Kate", "KBC"]},
            "language_presets": {
                language: {"overrides": {"agent": {"language": language, "first_message": first_message}}}
                for language in EXTRA_LANGUAGES
            },
            "conversation": {"max_duration_seconds": 600},
        },
        "platform_settings": {
            # Private agent: a conversation needs credentials that only kate-api can mint.
            "auth": {"enable_auth": True},
            # The browser may only choose the language (from the customer's profile).
            "overrides": {"conversation_config_override": {"agent": {"language": True}}},
        },
    }


class ElevenLabsApi:
    def __init__(self, api_key: str):
        self.http = httpx.Client(base_url=API_BASE, headers={"xi-api-key": api_key}, timeout=30)

    def call(self, method: str, path: str, **kwargs) -> dict:
        response = self.http.request(method, path, **kwargs)
        if response.status_code >= 400:
            sys.exit(f"ElevenLabs {method} {path} failed ({response.status_code}): {response.text[:2000]}")
        return response.json() if response.content else {}


def upsert_secret(api: ElevenLabsApi, value: str) -> str:
    secrets = api.call("GET", "/v1/convai/secrets", params={"search": SECRET_NAME}).get("secrets", [])
    existing = next((s for s in secrets if s.get("name") == SECRET_NAME), None)
    if existing:
        api.call("PATCH", f"/v1/convai/secrets/{existing['secret_id']}",
                 json={"type": "update", "name": SECRET_NAME, "value": value})
        log(f"secret   {SECRET_NAME} updated")
        return existing["secret_id"]
    created = api.call("POST", "/v1/convai/secrets", json={"type": "new", "name": SECRET_NAME, "value": value})
    log(f"secret   {SECRET_NAME} created")
    return created["secret_id"]


def upsert_tools(api: ElevenLabsApi, payloads: list[dict]) -> list[str]:
    existing: dict[str, str] = {}
    params: dict = {"search": "kate_", "page_size": 100}
    while True:
        page = api.call("GET", "/v1/convai/tools", params=params)
        existing.update({t["tool_config"]["name"]: t["id"] for t in page.get("tools", [])})
        if not page.get("has_more"):
            break
        params["cursor"] = page["next_cursor"]

    tool_ids = []
    for payload in payloads:
        name = payload["tool_config"]["name"]
        if name in existing:
            api.call("PATCH", f"/v1/convai/tools/{existing[name]}", json=payload)
            tool_ids.append(existing[name])
            log(f"tool     {name} updated")
        else:
            tool_ids.append(api.call("POST", "/v1/convai/tools", json=payload)["id"])
            log(f"tool     {name} created")
    return tool_ids


def upsert_agent(api: ElevenLabsApi, payload: dict) -> str:
    agents = api.call("GET", "/v1/convai/agents", params={"search": AGENT_NAME, "page_size": 100}).get("agents", [])
    existing = next((a for a in agents if a.get("name") == AGENT_NAME), None)
    if existing:
        api.call("PATCH", f"/v1/convai/agents/{existing['agent_id']}", json=payload)
        log(f"agent    {AGENT_NAME} updated")
        return existing["agent_id"]
    agent_id = api.call("POST", "/v1/convai/agents/create", json=payload)["agent_id"]
    log(f"agent    {AGENT_NAME} created")
    return agent_id


def list_voices(api: ElevenLabsApi) -> None:
    page = api.call("GET", "/v2/voices", params={"page_size": 100})
    for voice in page.get("voices", []):
        labels = voice.get("labels") or {}
        languages = ",".join(sorted({v.get("language", "") for v in voice.get("verified_languages") or []}))
        print(f"{voice['voice_id']}  {voice['name']:<28} {labels.get('gender', ''):<7} "
              f"{labels.get('accent', ''):<14} {languages}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--list-voices", action="store_true")
    args = parser.parse_args()

    api_url = os.environ.get("KATE_API_URL", "https://kate-api.example.run.app").rstrip("/")
    if args.dry_run:
        tools = tool_payloads(api_url, "<secret_id>")
        print(json.dumps({"tools": tools, "agent": agent_payload([f"<tool_id:{t['tool_config']['name']}>" for t in tools])},
                         indent=2, ensure_ascii=False))
        return

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not api_key:
        sys.exit("ELEVENLABS_API_KEY is not set")
    api = ElevenLabsApi(api_key)
    if args.list_voices:
        list_voices(api)
        return

    tool_secret = os.environ.get("TOOL_SHARED_SECRET", "")
    if not tool_secret or "KATE_API_URL" not in os.environ:
        sys.exit("TOOL_SHARED_SECRET and KATE_API_URL must be set (run infra/05_elevenlabs.sh)")
    if not api_url.startswith("https://"):
        sys.exit("KATE_API_URL must be https")

    secret_id = upsert_secret(api, tool_secret)
    tool_ids = upsert_tools(api, tool_payloads(api_url, secret_id))
    agent_id = upsert_agent(api, agent_payload(tool_ids))
    print(agent_id)


if __name__ == "__main__":
    main()
