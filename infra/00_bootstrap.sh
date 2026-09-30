#!/usr/bin/env bash
# APIs, least-privilege service accounts and the container registry.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

log "Project $GCP_PROJECT_ID, region $GCP_REGION"
log "Enabling APIs (1-2 minutes the first time)"
"${GC[@]}" services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  pubsub.googleapis.com bigquery.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com iam.googleapis.com logging.googleapis.com

create_sa() {
  local name=$1 description=$2
  if ! "${GC[@]}" iam service-accounts describe "$name@$GCP_PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1; then
    "${GC[@]}" iam service-accounts create "$name" --display-name="$description"
    log "created service account $name"
  fi
}
create_sa kate-api "Kate API (public Cloud Run edge)"
create_sa kate-engine "Kate moment engine (private Cloud Run)"
create_sa kate-pubsub-push "Pub/Sub push identity for kate-engine"
create_sa kate-build "Cloud Build for Kate images"

grant() {
  "${GC[@]}" projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$1" --role="$2" --condition=None >/dev/null
}
log "Granting roles (each service account only gets what it uses)"
# kate-api: Firestore (profiles, nudges), BigQuery (history, feedback), Pub/Sub publish is granted on the topic only.
grant "$SA_API" roles/datastore.user
grant "$SA_API" roles/bigquery.jobUser
grant "$SA_API" roles/bigquery.dataEditor
# kate-engine: the same data access plus Gemini on Vertex AI.
grant "$SA_ENGINE" roles/datastore.user
grant "$SA_ENGINE" roles/bigquery.jobUser
grant "$SA_ENGINE" roles/bigquery.dataEditor
grant "$SA_ENGINE" roles/aiplatform.user
# kate-build: build and push images, write build logs.
grant "$SA_BUILD" roles/cloudbuild.builds.builder
grant "$SA_BUILD" roles/artifactregistry.writer
grant "$SA_BUILD" roles/logging.logWriter
# kate-pubsub-push gets run.invoker on kate-engine only (04_deploy.sh).

if ! "${GC[@]}" artifacts repositories describe "$AR_REPO" --location="$GCP_REGION" >/dev/null 2>&1; then
  "${GC[@]}" artifacts repositories create "$AR_REPO" --repository-format=docker \
    --location="$GCP_REGION" --description="Kate container images"
  log "created Artifact Registry repository $AR_REPO"
fi
log "Bootstrap done"
