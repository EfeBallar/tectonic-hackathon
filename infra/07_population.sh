#!/usr/bin/env bash
# The scale story: generate the synthetic customer base in BigQuery, detect life moments for all of
# them in one query, then let Gemini write a sample of messages straight from SQL.
#   N_CUSTOMERS=100000 infra/07_population.sh      (quick run; default 2300000)
#   SKIP_AI=1 infra/07_population.sh               (no Gemini calls)
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
ensure_adc

N_CUSTOMERS="${N_CUSTOMERS:-2300000}"
log "Generating $N_CUSTOMERS synthetic customers and their transactions"
"$PY" -m kate.ops.run_sql sql/population.sql --var "N_CUSTOMERS=$N_CUSTOMERS"
log "Detecting life moments across the whole base"
"$PY" -m kate.ops.run_sql sql/batch_signals.sql
if [[ -z "${SKIP_AI:-}" ]]; then
  log "Gemini writes a sample of personalised messages from SQL (AI.GENERATE)"
  "$PY" -m kate.ops.run_sql sql/batch_nudges.sql --var "SAMPLE_PER_SIGNAL=${SAMPLE_PER_SIGNAL:-25}"
fi
