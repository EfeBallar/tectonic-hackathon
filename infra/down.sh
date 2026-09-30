#!/usr/bin/env bash
# Remove the running services, messaging and secrets. Data (BigQuery, Firestore) is kept unless --data.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

read -r -p "Type the project id ($GCP_PROJECT_ID) to delete Kate's cloud resources: " answer
[[ "$answer" == "$GCP_PROJECT_ID" ]] || die "aborted"

for service in "$API_SERVICE" "$ENGINE_SERVICE"; do
  "${GC[@]}" run services delete "$service" --region="$GCP_REGION" || true
done
for subscription in "$PUSH_SUBSCRIPTION" "$DLQ_SUBSCRIPTION"; do
  "${GC[@]}" pubsub subscriptions delete "$subscription" || true
done
for topic in "$TOPIC" "$DLQ_TOPIC"; do
  "${GC[@]}" pubsub topics delete "$topic" || true
done
for secret in "$SECRET_SESSION_KEY" "$SECRET_TOOL" "$SECRET_DEMO_CODE" "$SECRET_ELEVENLABS"; do
  "${GC[@]}" secrets delete "$secret" || true
done

if [[ "${1:-}" == "--data" ]]; then
  ensure_adc
  "$PY" - <<'EOF'
from kate import gcp
from kate.config import get_settings
s = get_settings()
gcp.bigquery_client().delete_dataset(f"{s.gcp_project_id}.{s.bq_dataset}", delete_contents=True, not_found_ok=True)
print(f"deleted BigQuery dataset {s.bq_dataset}")
EOF
  warn "Firestore data is left in place; delete the database in the console if needed."
fi
log "Done. The ElevenLabs agent still exists in your ElevenLabs workspace."
