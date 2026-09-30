#!/usr/bin/env bash
# Everything, in order. Every step is idempotent: re-run after fixing whatever failed.
set -euo pipefail
cd "$(dirname "$0")"
./00_bootstrap.sh
./01_data.sh
./02_pubsub.sh
./03_secrets.sh
./04_deploy.sh
./05_elevenlabs.sh
./06_seed.sh
echo
echo "Kate is up. Open the kate-api URL above, log in with the demo access code and trigger a life event."
echo "Optional scale demo (2.3M customers in BigQuery): infra/07_population.sh"
