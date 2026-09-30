"""All reads and writes to Firestore (serving state) and BigQuery (history + analytics).

Firestore
  customers/{customer_id}                      profile, consent, Kate's memory, demo_epoch
  customers/{customer_id}/nudges/{nudge_id}    proactive messages created by kate-engine
  customers/{customer_id}/callbacks/{id}       advisor callback requests

BigQuery (dataset ${BQ_DATASET})
  transactions   view = seed_transactions UNION ALL live_transactions
  signals        every detected signal + the policy decision
  nudge_events   created / accepted / dismissed ... (learning loop)
  population_*   the 2.3M synthetic customer base (sql/population.sql)

Every query is parameterised and every Firestore path is scoped by a customer id that comes
from a verified token.
"""

import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from kate import gcp
from kate.config import Settings
from kate.models import OPEN_NUDGE_STATUSES, Transaction

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
TXN_COLUMNS = "transaction_id, booked_at, amount, currency, counterparty, category, channel, country, description, balance_after"


def _plain(row: dict) -> dict:
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}


def demo_epoch(profile: dict | None) -> datetime:
    """Live transactions booked before the last demo reset are ignored (seed history is kept)."""
    value = (profile or {}).get("demo_epoch")
    return value if isinstance(value, datetime) else EPOCH


class Store:
    def __init__(self, settings: Settings):
        self.settings = settings

    # --- Firestore: customers ------------------------------------------------------------------

    def _customer(self, customer_id: str):
        return gcp.firestore_client().collection("customers").document(customer_id)

    def get_customer(self, customer_id: str) -> dict | None:
        snapshot = self._customer(customer_id).get()
        return snapshot.to_dict() if snapshot.exists else None

    def put_customer(self, profile: dict) -> None:
        self._customer(profile["customer_id"]).set(profile)

    def remember(self, customer_id: str, note: str, topic: str | None, mute_topic: bool) -> None:
        from google.cloud import firestore

        now = datetime.now(UTC)
        update = {
            "memory": firestore.ArrayUnion([{"note": note, "topic": topic or "", "created_at": now}]),
            "updated_at": now,
        }
        if mute_topic and topic:
            update["muted_topics"] = firestore.ArrayUnion([topic])
        self._customer(customer_id).update(update)

    def set_relevance(self, customer_id: str, topic: str, value: float) -> None:
        """topic comes from the fixed Topic vocabulary, so it is safe as a field path."""
        self._customer(customer_id).update({f"relevance.{topic}": value, "updated_at": datetime.now(UTC)})

    def reset_demo(self, customer_id: str) -> int:
        self._customer(customer_id).update(
            {"demo_epoch": datetime.now(UTC), "memory": [], "muted_topics": [], "relevance": {}})
        return self.delete_nudges(customer_id)

    # --- Firestore: nudges ---------------------------------------------------------------------

    def _nudges(self, customer_id: str):
        return self._customer(customer_id).collection("nudges")

    def list_nudges(self, customer_id: str, limit: int = 20, open_only: bool = False) -> list[dict]:
        from google.cloud import firestore

        query = self._nudges(customer_id).order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
        nudges = [doc.to_dict() for doc in query.stream()]
        # Filtered in memory on purpose: no composite index to manage during a hackathon.
        return [n for n in nudges if n.get("status") in OPEN_NUDGE_STATUSES] if open_only else nudges

    def nudges_since(self, customer_id: str, since: datetime) -> list[dict]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        query = self._nudges(customer_id).where(filter=FieldFilter("created_at", ">=", since))
        return [doc.to_dict() for doc in query.stream()]

    def get_nudge(self, customer_id: str, nudge_id: str) -> dict | None:
        snapshot = self._nudges(customer_id).document(nudge_id).get()
        return snapshot.to_dict() if snapshot.exists else None

    def create_nudge(self, nudge: dict) -> bool:
        """Create-if-absent: Pub/Sub delivers at least once, the deterministic id makes this idempotent."""
        from google.api_core.exceptions import AlreadyExists

        try:
            self._nudges(nudge["customer_id"]).document(nudge["nudge_id"]).create(nudge)
            return True
        except AlreadyExists:
            return False

    def update_nudge(self, customer_id: str, nudge_id: str, fields: dict) -> dict | None:
        ref = self._nudges(customer_id).document(nudge_id)
        snapshot = ref.get()
        if not snapshot.exists:
            return None
        ref.update(fields)
        return {**snapshot.to_dict(), **fields}

    def delete_nudges(self, customer_id: str) -> int:
        deleted = 0
        for doc in self._nudges(customer_id).stream():
            doc.reference.delete()
            deleted += 1
        return deleted

    def create_callback(self, customer_id: str, request: dict) -> str:
        ref = self._customer(customer_id).collection("callbacks").document()
        ref.set({**request, "customer_id": customer_id, "status": "requested", "created_at": datetime.now(UTC)})
        return ref.id

    # --- BigQuery ------------------------------------------------------------------------------

    def _query(self, sql: str, params: list | None = None) -> list[dict]:
        from google.cloud import bigquery

        job_config = bigquery.QueryJobConfig(query_parameters=params or [])
        rows = gcp.bigquery_client().query(sql, job_config=job_config, location=self.settings.bq_location).result()
        return [_plain(dict(row.items())) for row in rows]

    def _insert(self, table: str, rows: list[dict], row_ids: list[str] | None = None) -> None:
        errors = gcp.bigquery_client().insert_rows_json(self.settings.table(table), rows, row_ids=row_ids)
        if errors:
            raise RuntimeError(f"BigQuery insert into {table} failed: {errors}")

    @staticmethod
    def _customer_params(customer_id: str, since: datetime) -> list:
        from google.cloud import bigquery

        return [
            bigquery.ScalarQueryParameter("customer_id", "STRING", customer_id),
            bigquery.ScalarQueryParameter("since", "TIMESTAMP", since),
        ]

    def recent_transactions(
        self, customer_id: str, since: datetime, days: int, limit: int, category: str | None = None
    ) -> list[dict]:
        from google.cloud import bigquery

        sql = f"""
            SELECT {TXN_COLUMNS}
            FROM `{self.settings.table('transactions')}`
            WHERE customer_id = @customer_id
              AND (source = 'seed' OR ingested_at >= @since)
              AND booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
              AND (@category IS NULL OR category = @category)
            ORDER BY booked_at DESC
            LIMIT @limit"""
        params = self._customer_params(customer_id, since) + [
            bigquery.ScalarQueryParameter("days", "INT64", days),
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
            bigquery.ScalarQueryParameter("category", "STRING", category),
        ]
        return self._query(sql, params)

    def history(self, customer_id: str, since: datetime, exclude_transaction_id: str, days: int = 200) -> list[dict]:
        from google.cloud import bigquery

        sql = f"""
            SELECT {TXN_COLUMNS}
            FROM `{self.settings.table('transactions')}`
            WHERE customer_id = @customer_id
              AND (source = 'seed' OR ingested_at >= @since)
              AND booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
              AND transaction_id != @exclude
            ORDER BY booked_at"""
        params = self._customer_params(customer_id, since) + [
            bigquery.ScalarQueryParameter("days", "INT64", days),
            bigquery.ScalarQueryParameter("exclude", "STRING", exclude_transaction_id),
        ]
        return self._query(sql, params)

    def spending_summary(self, customer_id: str, since: datetime, days: int) -> dict:
        from google.cloud import bigquery

        sql = f"""
            SELECT
              category,
              ROUND(SUM(IF(booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY), amount, 0)), 2) AS current_period,
              ROUND(SUM(IF(booked_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY), amount, 0)), 2) AS previous_period
            FROM `{self.settings.table('transactions')}`
            WHERE customer_id = @customer_id
              AND (source = 'seed' OR ingested_at >= @since)
              AND booked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @lookback DAY)
            GROUP BY category
            ORDER BY current_period"""
        params = self._customer_params(customer_id, since) + [
            bigquery.ScalarQueryParameter("days", "INT64", days),
            bigquery.ScalarQueryParameter("lookback", "INT64", days * 2),
        ]
        rows = self._query(sql, params)
        return {
            "period_days": days,
            "money_in": round(sum(r["current_period"] for r in rows if r["current_period"] > 0), 2),
            "money_out": round(-sum(r["current_period"] for r in rows if r["current_period"] < 0), 2),
            "by_category": rows,
        }

    def latest_balance(self, customer_id: str, since: datetime) -> float | None:
        sql = f"""
            SELECT balance_after
            FROM `{self.settings.table('transactions')}`
            WHERE customer_id = @customer_id
              AND (source = 'seed' OR ingested_at >= @since)
              AND balance_after IS NOT NULL
            ORDER BY booked_at DESC
            LIMIT 1"""
        rows = self._query(sql, self._customer_params(customer_id, since))
        return rows[0]["balance_after"] if rows else None

    def insert_live_transaction(self, transaction: Transaction) -> None:
        # row_ids = best-effort de-duplication of Pub/Sub redeliveries
        self._insert("live_transactions", [transaction.to_row("live")], row_ids=[transaction.transaction_id])

    def record_signal(self, signal: dict) -> None:
        row = {**signal, "evidence": json.dumps(signal.get("evidence") or {}, default=str)}
        row["detected_at"] = row["detected_at"].isoformat()
        self._insert("signals", [row], row_ids=[row["signal_id"]])

    def record_nudge_event(self, nudge: dict, event_type: str, detail: dict | None = None) -> None:
        row = {
            "event_id": uuid.uuid4().hex,
            "nudge_id": nudge["nudge_id"],
            "customer_id": nudge["customer_id"],
            "signal_type": nudge.get("signal_type"),
            "event_type": event_type,
            "occurred_at": datetime.now(UTC).isoformat(),
            "detail": json.dumps(detail or {}, default=str),
        }
        self._insert("nudge_events", [row], row_ids=[row["event_id"]])

    def analytics_overview(self, hours: int = 24) -> dict:
        from google.api_core.exceptions import NotFound
        from google.cloud import bigquery

        overview: dict = {"population": None}
        try:
            population = self._query(
                f"""SELECT signal_type, COUNT(*) AS customers
                    FROM `{self.settings.table('population_signals')}`
                    GROUP BY signal_type ORDER BY customers DESC"""
            )
            total = self._query(f"SELECT COUNT(*) AS n FROM `{self.settings.table('population_customers')}`")
            overview["population"] = {"customers": total[0]["n"], "signals": population}
        except NotFound:
            pass  # sql/population.sql has not been run yet
        overview["live"] = self._query(
            f"""SELECT signal_type, decision, COUNT(*) AS signals
                FROM `{self.settings.table('signals')}`
                WHERE detected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR)
                GROUP BY signal_type, decision ORDER BY signals DESC""",
            [bigquery.ScalarQueryParameter("hours", "INT64", hours)],
        )
        overview["window_hours"] = hours
        overview["generated_at"] = datetime.now(UTC)
        return overview
