"""Publishes transaction events to Pub/Sub (the same path a core-banking feed would use)."""

from kate import gcp
from kate.config import Settings
from kate.models import Transaction


class EventPublisher:
    def __init__(self, settings: Settings):
        self.settings = settings

    def publish(self, txn: Transaction, source: str) -> str:
        client = gcp.publisher_client()
        topic = client.topic_path(self.settings.gcp_project_id, self.settings.pubsub_transactions_topic)
        future = client.publish(topic, txn.model_dump_json().encode(), customer_id=txn.customer_id, source=source)
        return future.result(timeout=15)
