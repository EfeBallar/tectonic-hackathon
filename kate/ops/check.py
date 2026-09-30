"""Smoke test of every cloud dependency from your laptop: python -m kate.ops.check"""

import sys
import traceback

from kate import gcp
from kate.config import get_settings


def check_bigquery(s):
    rows = list(gcp.bigquery_client().query(
        f"SELECT COUNT(*) AS n FROM `{s.table('transactions')}`", location=s.bq_location).result())
    return f"{rows[0]['n']} transactions visible in {s.bq_dataset}.transactions"


def check_firestore(s):
    docs = list(gcp.firestore_client().collection("customers").limit(10).stream())
    return f"{len(docs)} customer profile(s) in Firestore"


def check_pubsub(s):
    client = gcp.publisher_client()
    topic = client.get_topic(topic=client.topic_path(s.gcp_project_id, s.pubsub_transactions_topic))
    return f"topic {topic.name} exists"


def check_gemini(s):
    response = gcp.genai_client().models.generate_content(model=s.gemini_model, contents="Reply with the word OK.")
    return f"{s.gemini_model} @ {s.gemini_location} answered {response.text.strip()[:20]!r}"


def main() -> None:
    s = get_settings()
    print(f"project={s.gcp_project_id} region={s.gcp_region} dataset={s.bq_dataset}")
    failed = False
    for name, fn in (("BigQuery", check_bigquery), ("Firestore", check_firestore),
                     ("Pub/Sub", check_pubsub), ("Gemini", check_gemini)):
        try:
            print(f"  ok    {name:<10} {fn(s)}")
        except Exception as exc:
            failed = True
            print(f"  FAIL  {name:<10} {type(exc).__name__}: {str(exc)[:300]}")
            if "-v" in sys.argv:
                traceback.print_exc()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
