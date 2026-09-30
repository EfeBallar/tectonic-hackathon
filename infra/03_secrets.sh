#!/usr/bin/env bash
# Secret Manager: generated secrets + the ElevenLabs key from .env. Nothing secret ever goes into git.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

generate() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"${1:-48}"; }

create_secret() {  # create with a first version, only if it does not exist yet
  local name=$1 value=$2
  if ! "${GC[@]}" secrets describe "$name" >/dev/null 2>&1; then
    "${GC[@]}" secrets create "$name" --replication-policy=user-managed --locations="$GCP_REGION" >/dev/null
    printf '%s' "$value" | "${GC[@]}" secrets versions add "$name" --data-file=- >/dev/null
    log "created secret $name"
  fi
}

set_secret() {  # create, or add a version when the value changed
  local name=$1 value=$2
  if "${GC[@]}" secrets describe "$name" >/dev/null 2>&1; then
    if [[ "$(secret_value "$name" 2>/dev/null || true)" != "$value" ]]; then
      printf '%s' "$value" | "${GC[@]}" secrets versions add "$name" --data-file=- >/dev/null
      log "updated secret $name"
    fi
  else
    create_secret "$name" "$value"
  fi
}

create_secret "$SECRET_SESSION_KEY" "$(generate 48)"
create_secret "$SECRET_TOOL" "$(generate 48)"
if [[ -n "${DEMO_ACCESS_CODE:-}" ]]; then
  set_secret "$SECRET_DEMO_CODE" "$DEMO_ACCESS_CODE"
else
  create_secret "$SECRET_DEMO_CODE" "$(generate 12)"
fi
if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then
  set_secret "$SECRET_ELEVENLABS" "$ELEVENLABS_API_KEY"
elif ! "${GC[@]}" secrets describe "$SECRET_ELEVENLABS" >/dev/null 2>&1; then
  die "Put ELEVENLABS_API_KEY in .env (it is stored in Secret Manager, never in git)"
fi

# Optional: Gemini API key for projects where Vertex AI is blocked. Only kate-engine may read it.
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  set_secret "$SECRET_GEMINI" "$GEMINI_API_KEY"
  "${GC[@]}" secrets add-iam-policy-binding "$SECRET_GEMINI" \
    --member="serviceAccount:$SA_ENGINE" --role=roles/secretmanager.secretAccessor >/dev/null
fi

# kate-api reads these four secrets and nothing else.
for secret in "$SECRET_SESSION_KEY" "$SECRET_TOOL" "$SECRET_DEMO_CODE" "$SECRET_ELEVENLABS"; do
  "${GC[@]}" secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$SA_API" --role=roles/secretmanager.secretAccessor >/dev/null
done
log "Secrets ready. Demo access code: $(secret_value "$SECRET_DEMO_CODE")"
