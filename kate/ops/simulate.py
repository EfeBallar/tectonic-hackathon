"""Publish a persona's scripted life event to Pub/Sub, like a real payment arriving.

    python -m kate.ops.simulate --list
    python -m kate.ops.simulate D001 moved_house
"""

import argparse
import sys
from datetime import UTC, datetime

from kate.config import get_settings
from kate.events import EventPublisher
from kate.personas import PERSONAS, build_event_transactions
from kate.store import Store, demo_epoch


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("customer_id", nargs="?")
    parser.add_argument("event_id", nargs="?")
    parser.add_argument("--list", action="store_true", help="show personas and their events")
    args = parser.parse_args()

    if args.list or not (args.customer_id and args.event_id):
        for persona in PERSONAS.values():
            print(f"{persona.customer_id}  {persona.first_name} ({persona.language}, {persona.city}): {persona.story}")
            for event in persona.events:
                print(f"      {event.event_id:<18} {event.label}")
        return

    persona = PERSONAS.get(args.customer_id)
    event = persona.event(args.event_id) if persona else None
    if event is None:
        sys.exit("unknown persona or event, see --list")

    settings = get_settings()
    store = Store(settings)
    profile = store.get_customer(persona.customer_id)
    balance = store.latest_balance(persona.customer_id, demo_epoch(profile))
    publisher = EventPublisher(settings)
    for txn in build_event_transactions(persona, event, datetime.now(UTC), balance):
        message_id = publisher.publish(txn, source="simulate")
        print(f"published {txn.transaction_id}: {txn.counterparty} {txn.amount:.2f} EUR (message {message_id})")


if __name__ == "__main__":
    main()
