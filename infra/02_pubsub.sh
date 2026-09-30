#!/usr/bin/env bash
# Pub/Sub topics. The push subscription is created by 04_deploy.sh once kate-engine has a URL.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

for topic in "$TOPIC" "$DLQ_TOPIC"; do
  if ! "${GC[@]}" pubsub topics describe "$topic" >/dev/null 2>&1; then
    "${GC[@]}" pubsub topics create "$topic"
    log "created topic $topic"
  fi
done

# Messages kate-engine could not process after 5 attempts end up here for inspection.
if ! "${GC[@]}" pubsub subscriptions describe "$DLQ_SUBSCRIPTION" >/dev/null 2>&1; then
  "${GC[@]}" pubsub subscriptions create "$DLQ_SUBSCRIPTION" --topic="$DLQ_TOPIC" --message-retention-duration=7d
fi

# kate-api publishes the demo life events.
"${GC[@]}" pubsub topics add-iam-policy-binding "$TOPIC" \
  --member="serviceAccount:$SA_API" --role=roles/pubsub.publisher >/dev/null

# The Pub/Sub service agent forwards dead letters.
PUBSUB_AGENT="service-$(project_number)@gcp-sa-pubsub.iam.gserviceaccount.com"
"${GC[@]}" pubsub topics add-iam-policy-binding "$DLQ_TOPIC" \
  --member="serviceAccount:$PUBSUB_AGENT" --role=roles/pubsub.publisher >/dev/null \
  || warn "could not grant the Pub/Sub service agent on $DLQ_TOPIC (dead-lettering disabled)"
log "Pub/Sub ready"
