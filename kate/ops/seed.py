"""Load the demo personas: profiles -> Firestore, six months of history -> BigQuery.

Safe to re-run: BigQuery tables are replaced with load jobs (no DML on streamed rows) and each
persona's Firestore profile and nudges are reset.
"""

from datetime import UTC, datetime

from kate import gcp
from kate.config import get_settings
from kate.personas import PERSONAS, generate_history, profile_document
from kate.store import Store


def replace_table(table_id: str, rows: list[dict]) -> None:
    from google.cloud import bigquery

    client = gcp.bigquery_client()
    table = client.get_table(table_id)  # created by sql/schema.sql
    job_config = bigquery.LoadJobConfig(
        schema=table.schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        time_partitioning=table.time_partitioning,
        clustering_fields=table.clustering_fields,
    )
    client.load_table_from_json(rows, table_id, job_config=job_config).result()


def main() -> None:
    settings = get_settings()
    store = Store(settings)
    now = datetime.now(UTC)
    customers, transactions = [], []

    for persona in PERSONAS.values():
        history = generate_history(persona, now)
        transactions += [txn.to_row("seed", ingested_at=now) for txn in history]
        customers.append({
            "customer_id": persona.customer_id,
            "first_name": persona.first_name,
            "age": persona.age,
            "language": persona.language,
            "city": persona.city,
            "segment": persona.segment,
            "products": list(persona.products),
            "created_at": now.isoformat(),
        })
        store.put_customer(profile_document(persona, now))
        removed = store.delete_nudges(persona.customer_id)
        print(f"{persona.customer_id} {persona.first_name:<8} {len(history):>4} transactions, "
              f"balance {history[-1].balance_after:>9.2f} EUR, {removed} old nudge(s) removed")

    replace_table(settings.table("customers"), customers)
    replace_table(settings.table("seed_transactions"), transactions)
    print(f"Loaded {len(customers)} personas and {len(transactions)} transactions into {settings.bq_dataset}")


if __name__ == "__main__":
    main()
