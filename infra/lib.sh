#!/usr/bin/env bash
# Shared configuration and helpers for the infra scripts. Sourced, never executed directly.
# shellcheck disable=SC2034  # variables are used by the scripts that source this file
set -euo pipefail

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

command -v gcloud >/dev/null || die "gcloud is not installed: https://cloud.google.com/sdk/docs/install"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
[[ -n "$GCP_PROJECT_ID" ]] || die "Set GCP_PROJECT_ID in .env (or: gcloud config set project <id>)"
GCP_REGION="${GCP_REGION:-europe-west1}"
BQ_DATASET="${BQ_DATASET:-kate}"
BQ_LOCATION="${BQ_LOCATION:-$GCP_REGION}"
FIRESTORE_DATABASE="${FIRESTORE_DATABASE:-(default)}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.5-flash}"
GEMINI_LOCATION="${GEMINI_LOCATION:-eu}"
GEMINI_THINKING_LEVEL="${GEMINI_THINKING_LEVEL:-low}"
ELEVENLABS_VOICE_ID="${ELEVENLABS_VOICE_ID:-EXAVITQu4vr4xnSDxMaL}"
ELEVENLABS_TTS_MODEL="${ELEVENLABS_TTS_MODEL:-eleven_multilingual_v2}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
BUILD_MODE="${BUILD_MODE:-cloudbuild}"
export GCP_PROJECT_ID GCP_REGION BQ_DATASET BQ_LOCATION FIRESTORE_DATABASE GEMINI_MODEL GEMINI_LOCATION GEMINI_THINKING_LEVEL

# Resource names
AR_REPO="kate"
IMAGE_BASE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${AR_REPO}/kate"
API_SERVICE="kate-api"
ENGINE_SERVICE="kate-engine"
TOPIC="kate-transactions"
DLQ_TOPIC="kate-transactions-dlq"
DLQ_SUBSCRIPTION="kate-transactions-dlq-inspect"
PUSH_SUBSCRIPTION="kate-transactions-engine"
SA_API="kate-api@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
SA_ENGINE="kate-engine@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
SA_PUSH="kate-pubsub-push@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
SA_BUILD="kate-build@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
SECRET_SESSION_KEY="kate-session-signing-key"
SECRET_TOOL="kate-tool-shared-secret"
SECRET_DEMO_CODE="kate-demo-access-code"
SECRET_ELEVENLABS="kate-elevenlabs-api-key"
SECRET_GEMINI="kate-gemini-api-key"

PY="$ROOT_DIR/.venv/bin/python"
GC=(gcloud --project="$GCP_PROJECT_ID" --quiet)

project_number() { "${GC[@]}" projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)'; }

service_url() { "${GC[@]}" run services describe "$1" --region="$GCP_REGION" --format='value(status.url)' 2>/dev/null || true; }

require_python() { [[ -x "$PY" ]] || die "Run 'make setup' first (creates .venv with the Python dependencies)"; }

# Local Python tools (seed, SQL, checks) use Application Default Credentials.
ensure_adc() {
  require_python
  gcloud auth application-default print-access-token >/dev/null 2>&1 \
    || die "No Application Default Credentials. Run: gcloud auth application-default login (with the hackathon account)"
  gcloud auth application-default set-quota-project "$GCP_PROJECT_ID" >/dev/null 2>&1 \
    || warn "Could not set the ADC quota project; Firestore calls from this laptop may fail"
}

secret_value() { "${GC[@]}" secrets versions access latest --secret="$1"; }
