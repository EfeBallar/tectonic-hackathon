import re

from agent.sync import PLACEHOLDERS, PROMPT, agent_payload, tool_payloads
from kate.api.tools import router

API_URL = "https://kate-api-123.europe-west1.run.app"


def test_tools_point_at_existing_routes_and_carry_both_headers():
    tools = [t["tool_config"] for t in tool_payloads(API_URL, "sec_123")]
    routes = {(route.path, method) for route in router.routes for method in route.methods}
    assert len({t["name"] for t in tools}) == len(tools) == 7
    for tool in tools:
        schema = tool["api_schema"]
        assert schema["url"].startswith(f"{API_URL}/tools/")
        assert (schema["url"].removeprefix(API_URL), schema["method"]) in routes
        assert schema["request_headers"] == {
            "X-Kate-Tool-Secret": {"secret_id": "sec_123"},
            "X-Kate-Session": {"variable_name": "session_token"},
        }
        body = schema.get("request_body_schema")
        if body:
            assert set(body["required"]) <= set(body["properties"])
            assert all(p["type"] in ("string", "integer", "boolean", "number") for p in body["properties"].values())


def test_agent_is_private_and_every_variable_has_a_placeholder():
    payload = agent_payload(["tool_1"])
    config = payload["conversation_config"]
    assert payload["platform_settings"]["auth"]["enable_auth"] is True
    assert config["agent"]["prompt"]["tool_ids"] == ["tool_1"]
    used = set(re.findall(r"{{\s*(\w+)\s*}}", PROMPT + config["agent"]["first_message"])) | {"session_token"}
    assert used <= set(config["agent"]["dynamic_variables"]["dynamic_variable_placeholders"])
    assert set(PLACEHOLDERS) >= used
    assert config["tts"]["model_id"].endswith("v2_5")  # multilingual model needed for nl/fr
