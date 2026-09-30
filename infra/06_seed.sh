#!/usr/bin/env bash
# Load the demo personas (Firestore profiles + six months of BigQuery history). Safe to re-run.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
ensure_adc
"$PY" -m kate.ops.seed
