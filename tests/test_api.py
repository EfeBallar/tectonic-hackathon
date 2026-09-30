from datetime import UTC, datetime

from conftest import ACCESS_CODE, TOOL_SECRET, login

from kate.config import get_settings
from kate.security import VOICE_AUDIENCE, verify_token


def tool_headers(client, customer_id="D001") -> dict:
    session = client.post("/api/voice/session", json={}, headers=login(client, customer_id)).json()
    return {"X-Kate-Tool-Secret": TOOL_SECRET, "X-Kate-Session": session["dynamic_variables"]["session_token"]}


def trigger(client, headers, event_id):
    response = client.post("/api/demo/events", json={"event_id": event_id}, headers=headers)
    assert response.status_code == 202, response.text
    return response.json()


def test_personas_and_login(client):
    assert len(client.get("/api/demo/personas").json()) == 4
    assert client.post("/api/auth/demo-login", json={"access_code": "wrong", "customer_id": "D001"}).status_code == 401
    assert client.post("/api/auth/demo-login", json={"access_code": ACCESS_CODE, "customer_id": "P00000001"}).status_code == 404
    me = client.get("/api/me", headers=login(client))
    assert me.status_code == 200 and me.json()["first_name"] == "Lotte"
    assert client.get("/api/me").status_code == 401


def test_login_is_rate_limited(client):
    codes = [client.post("/api/auth/demo-login", json={"access_code": "guess", "customer_id": "D001"}).status_code
             for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_roles_are_enforced(client):
    analyst = client.post("/api/auth/analyst-login", json={"access_code": ACCESS_CODE}).json()["token"]
    analyst_headers = {"Authorization": f"Bearer {analyst}"}
    assert client.get("/api/me", headers=analyst_headers).status_code == 403
    assert client.get("/api/analytics/overview", headers=login(client)).status_code == 403
    assert client.get("/api/analytics/overview", headers=analyst_headers).status_code == 200


def test_life_event_to_nudge_to_feedback(client, store):
    headers = login(client)
    result = trigger(client, headers, "moved_house")
    assert result["transactions"][0]["customer_id"] == "D001"
    nudges = client.get("/api/nudges", headers=headers).json()
    assert [n["signal_type"] for n in nudges] == ["moved_house"]
    nudge_id = nudges[0]["nudge_id"]

    audio = client.get(f"/api/nudges/{nudge_id}/audio", headers=headers)
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"

    answered = client.post(f"/api/nudges/{nudge_id}/respond", json={"response": "accepted"}, headers=headers)
    assert answered.json()["status"] == "accepted"
    assert (nudge_id, "accepted") in store.nudge_events


def test_customers_cannot_touch_each_others_nudges(client):
    youssef = login(client, "D002")
    trigger(client, youssef, "growing_family")
    nudge_id = client.get("/api/nudges", headers=youssef).json()[0]["nudge_id"]

    lotte = login(client, "D001")
    assert client.get(f"/api/nudges/{nudge_id}/audio", headers=lotte).status_code == 404
    assert client.post(f"/api/nudges/{nudge_id}/respond", json={"response": "dismissed"}, headers=lotte).status_code == 404
    assert client.post("/api/voice/session", json={"nudge_id": nudge_id}, headers=lotte).status_code == 404
    assert client.post("/api/demo/events", json={"event_id": "growing_family"}, headers=lotte).status_code == 404
    other_tools = tool_headers(client, "D001")
    response = client.post("/tools/nudge-response", json={"nudge_id": nudge_id, "response": "dismissed"}, headers=other_tools)
    assert response.status_code == 404


def test_voice_session(client):
    headers = login(client, "D002")
    trigger(client, headers, "vehicle_purchase")
    nudge = client.get("/api/nudges", headers=headers).json()[0]
    session = client.post("/api/voice/session", json={"nudge_id": nudge["nudge_id"]}, headers=headers).json()
    variables = session["dynamic_variables"]
    assert session["language"] == "fr" and session["conversation_token"] == "webrtc-token"
    assert variables["opening_line"].startswith("Bonjour Youssef") and nudge["title"] in variables["opening_line"]
    assert verify_token(get_settings(), variables["session_token"], VOICE_AUDIENCE).customer_id == "D002"


def test_tools_require_secret_and_voice_session(client):
    good = tool_headers(client)
    app_token = login(client)["Authorization"].removeprefix("Bearer ")
    assert client.get("/tools/customer-overview").status_code == 401
    assert client.get("/tools/customer-overview", headers={**good, "X-Kate-Tool-Secret": "nope"}).status_code == 401
    assert client.get("/tools/customer-overview", headers={**good, "X-Kate-Session": app_token}).status_code == 401
    overview = client.get("/tools/customer-overview", headers=good)
    assert overview.status_code == 200 and overview.json()["customer"]["first_name"] == "Lotte"


def test_tools(client, store):
    headers = tool_headers(client)
    txns = client.post("/tools/recent-transactions", json={"days": 60, "category": "rent"}, headers=headers).json()
    assert txns["transactions"] and all(t["category"] == "rent" for t in txns["transactions"])
    assert client.post("/tools/recent-transactions", json={"days": 999}, headers=headers).status_code == 422
    assert client.post("/tools/spending-summary", json={"days": 30}, headers=headers).status_code == 200

    remember = client.post("/tools/remember", json={"note": "No travel offers please", "topic": "travel", "mute_topic": True},
                           headers=headers)
    assert remember.json()["muted_topic"] == "travel"
    assert "travel" in store.customers["D001"]["muted_topics"]

    assert client.post("/tools/product-info", json={"product_id": "home_insurance"}, headers=headers).status_code == 200
    assert client.post("/tools/product-info", json={"product_id": "crypto_yolo"}, headers=headers).status_code == 404
    callback = client.post("/tools/advisor-callback", json={"topic": "Mortgage for the new flat"}, headers=headers)
    assert callback.json()["ok"] and store.callbacks[0]["customer_id"] == "D001"


def test_reset_demo(client, store):
    headers = login(client)
    trigger(client, headers, "moved_house")
    assert client.post("/api/demo/reset", headers=headers).json() == {"deleted_nudges": 1}
    assert store.customers["D001"]["demo_epoch"] <= datetime.now(UTC)
    trigger(client, headers, "moved_house")  # works again after a reset
    assert len(client.get("/api/nudges", headers=headers).json()) == 1


def test_security_headers(client):
    response = client.get("/api/me", headers=login(client))
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/docs").status_code == 404  # docs only exist when ENV=local
