#!/usr/bin/env bash
# Push the ElevenLabs agent + tools (agent/sync.py) and give kate-api the agent id.
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
require_python

API_URL="$(service_url "$API_SERVICE")"
[[ -n "$API_URL" ]] || die "Deploy first: infra/04_deploy.sh"
ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-$(secret_value "$SECRET_ELEVENLABS")}"
TOOL_SHARED_SECRET="$(secret_value "$SECRET_TOOL")"
export ELEVENLABS_API_KEY TOOL_SHARED_SECRET KATE_API_URL="$API_URL"

log "Syncing the ElevenLabs agent (tools call $API_URL/tools/*)"
AGENT_ID="$("$PY" -m agent.sync)"
[[ -n "$AGENT_ID" ]] || die "agent sync did not return an agent id"

CURRENT="$("${GC[@]}" run services describe "$API_SERVICE" --region="$GCP_REGION" --format=json \
  | "$PY" -c 'import json,sys; env=json.load(sys.stdin)["spec"]["template"]["spec"]["containers"][0].get("env",[]); print(next((e.get("value","") for e in env if e["name"]=="ELEVENLABS_AGENT_ID"),""))')"
if [[ "$CURRENT" != "$AGENT_ID" ]]; then
  "${GC[@]}" run services update "$API_SERVICE" --region="$GCP_REGION" --update-env-vars="ELEVENLABS_AGENT_ID=$AGENT_ID" >/dev/null
fi
log "Agent $AGENT_ID is live. Talk to it from $API_URL"
