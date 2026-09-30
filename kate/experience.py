"""Run the browser's deterministic engine on an authenticated, server-owned snapshot.

The small Node process handles interactive demo accounts; population workloads continue
through the existing SQL/PubSub engine. No JavaScript or customer balances come from clients.
"""
import copy
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ASSETS = Path(__file__).parent / "assets"
HEROES = {h["customer_id"]: h for h in json.loads((ASSETS / "heroes.json").read_text())}


def week_key():
    return datetime.now(UTC).strftime("%G-%V")


def run_engine(customer, action=None, budget=3):
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node is required by the shared customer engine")
    payload = json.dumps({"customer": customer, "action": action, "budget": budget}, allow_nan=False)
    if len(payload) > 500_000:
        raise ValueError("Customer snapshot too large")
    result = subprocess.run([node, str(ASSETS / "experience-engine.cjs")], input=payload,
                            text=True, capture_output=True, timeout=5)
    if result.returncode:
        raise ValueError("The moment changed. Refresh before acting.")
    return json.loads(result.stdout)


def hero_profile(customer_id):
    c = copy.deepcopy(HEROES[customer_id]["customer"])
    first, _, last = c["name"].partition(" ")
    return {"customer_id": customer_id, "first_name": first, "last_name": last, "age": c["age"],
            "city": c["city"], "segment": c["segment"], "language": "en",
            "products": [k for k, v in c["products"].items() if v],
            "consent": {"proactive": True}, "muted_topics": [], "memory": [],
            "experience": {"customer": c, "revision": 0, "budget": 3, "week": week_key()},
            "demo_epoch": datetime.now(UTC)}
