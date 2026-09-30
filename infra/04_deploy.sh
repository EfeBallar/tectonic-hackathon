#!/usr/bin/env bash
# Build one image, deploy it twice: kate-engine (private, fed by Pub/Sub) and kate-api (public).
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

IMAGE="$IMAGE_BASE:$(date +%Y%m%d-%H%M%S)"

log "Building $IMAGE ($BUILD_MODE)"
if [[ "$BUILD_MODE" == "docker" ]]; then
  gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet >/dev/null
  docker build --platform linux/amd64 -t "$IMAGE" .
  docker push "$IMAGE"
else
  "${GC[@]}" builds submit . --region="$GCP_REGION" --config=infra/cloudbuild.yaml \
    --substitutions="_IMAGE=$IMAGE" \
    --service-account="projects/$GCP_PROJECT_ID/serviceAccounts/$SA_BUILD" \
    --default-buckets-behavior=regional-user-owned-bucket \
    || die "Cloud Build failed. Retry in a minute (new IAM grants take time to apply) or set BUILD_MODE=docker"
fi

# Env lists use ";" as separator (gcloud's ^;^ syntax) so values such as CORS origins may contain commas.
COMMON_ENV="GCP_PROJECT_ID=$GCP_PROJECT_ID;GCP_REGION=$GCP_REGION;BQ_DATASET=$BQ_DATASET;BQ_LOCATION=$BQ_LOCATION;FIRESTORE_DATABASE=$FIRESTORE_DATABASE"

# --- kate-engine: private. Only the Pub/Sub push identity may invoke it. ---
ENGINE_URL="$(service_url "$ENGINE_SERVICE")"
ENGINE_ENV="APP=engine;$COMMON_ENV;GEMINI_MODEL=$GEMINI_MODEL;GEMINI_LOCATION=$GEMINI_LOCATION;GEMINI_THINKING_LEVEL=$GEMINI_THINKING_LEVEL;PUSH_SERVICE_ACCOUNT=$SA_PUSH"
[[ -n "$ENGINE_URL" ]] && ENGINE_ENV="$ENGINE_ENV;PUSH_AUDIENCE=$ENGINE_URL"
log "Deploying $ENGINE_SERVICE"
"${GC[@]}" run deploy "$ENGINE_SERVICE" --image="$IMAGE" --region="$GCP_REGION" \
  --service-account="$SA_ENGINE" --no-allow-unauthenticated \
  --update-env-vars="^;^$ENGINE_ENV" \
  --cpu=1 --memory=512Mi --concurrency=20 --min-instances="$MIN_INSTANCES" --max-instances=10 --timeout=120
if [[ -z "$ENGINE_URL" ]]; then  # first deploy: the URL (= expected token audience) is only known now
  ENGINE_URL="$(service_url "$ENGINE_SERVICE")"
  "${GC[@]}" run services update "$ENGINE_SERVICE" --region="$GCP_REGION" --update-env-vars="PUSH_AUDIENCE=$ENGINE_URL" >/dev/null
fi
"${GC[@]}" run services add-iam-policy-binding "$ENGINE_SERVICE" --region="$GCP_REGION" \
  --member="serviceAccount:$SA_PUSH" --role=roles/run.invoker >/dev/null

PUSH_FLAGS=(--push-endpoint="$ENGINE_URL/pubsub/transactions" --push-auth-service-account="$SA_PUSH"
            --push-auth-token-audience="$ENGINE_URL")
if "${GC[@]}" pubsub subscriptions describe "$PUSH_SUBSCRIPTION" >/dev/null 2>&1; then
  "${GC[@]}" pubsub subscriptions update "$PUSH_SUBSCRIPTION" "${PUSH_FLAGS[@]}" >/dev/null
else
  "${GC[@]}" pubsub subscriptions create "$PUSH_SUBSCRIPTION" --topic="$TOPIC" "${PUSH_FLAGS[@]}" \
    --ack-deadline=60 --min-retry-delay=5s --max-retry-delay=120s \
    --dead-letter-topic="$DLQ_TOPIC" --max-delivery-attempts=5
  log "created push subscription $PUSH_SUBSCRIPTION"
fi
PUBSUB_AGENT="service-$(project_number)@gcp-sa-pubsub.iam.gserviceaccount.com"
"${GC[@]}" pubsub subscriptions add-iam-policy-binding "$PUSH_SUBSCRIPTION" \
  --member="serviceAccount:$PUBSUB_AGENT" --role=roles/pubsub.subscriber >/dev/null \
  || warn "could not grant the Pub/Sub service agent on $PUSH_SUBSCRIPTION (dead-lettering disabled)"

# --- kate-api: public edge. Authentication happens in the app (sessions, tool secret). ---
log "Deploying $API_SERVICE"
"${GC[@]}" run deploy "$API_SERVICE" --image="$IMAGE" --region="$GCP_REGION" \
  --service-account="$SA_API" \
  --update-env-vars="^;^APP=api;$COMMON_ENV;PUBSUB_TRANSACTIONS_TOPIC=$TOPIC;ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID;ELEVENLABS_TTS_MODEL=$ELEVENLABS_TTS_MODEL;CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-}" \
  --update-secrets="SESSION_SIGNING_KEY=$SECRET_SESSION_KEY:latest,TOOL_SHARED_SECRET=$SECRET_TOOL:latest,DEMO_ACCESS_CODE=$SECRET_DEMO_CODE:latest,ELEVENLABS_API_KEY=$SECRET_ELEVENLABS:latest" \
  --cpu=1 --memory=512Mi --concurrency=40 --min-instances="$MIN_INSTANCES" --max-instances=10 --timeout=300
API_URL="$(service_url "$API_SERVICE")"

# ElevenLabs and browsers must reach kate-api without Google credentials.
if ! "${GC[@]}" run services add-iam-policy-binding "$API_SERVICE" --region="$GCP_REGION" \
     --member=allUsers --role=roles/run.invoker >/dev/null 2>&1; then
  warn "An org policy blocks allUsers; disabling the Cloud Run invoker IAM check instead"
  "${GC[@]}" run services update "$API_SERVICE" --region="$GCP_REGION" --no-invoker-iam-check >/dev/null \
    || die "kate-api is not reachable publicly. Ask the organisers about the iam.allowedPolicyMemberDomains policy."
fi

for attempt in 1 2 3 4 5 6; do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then break; fi
  [[ $attempt == 6 ]] && die "$API_URL/health is not answering"
  sleep 5
done
log "kate-engine  $ENGINE_URL  (private)"
log "kate-api     $API_URL"
log "Next: infra/05_elevenlabs.sh (voice agent) and infra/06_seed.sh (demo personas)"
