#!/usr/bin/env bash
# BigQuery dataset + tables, Firestore database.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
ensure_adc

log "BigQuery dataset $BQ_DATASET ($BQ_LOCATION)"
"$PY" -m kate.ops.run_sql sql/schema.sql

log "Firestore database $FIRESTORE_DATABASE ($GCP_REGION)"
if "${GC[@]}" firestore databases describe --database="$FIRESTORE_DATABASE" >/dev/null 2>&1; then
  log "Firestore database already exists"
else
  "${GC[@]}" firestore databases create --database="$FIRESTORE_DATABASE" \
    --location="$GCP_REGION" --type=firestore-native
fi
log "Data layer ready"
