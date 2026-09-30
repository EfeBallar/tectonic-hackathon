# Merge handoff

Rechecked and fetched September 30, 2026 at **20:57 Brussels**; deadline 23:00. This is the
current integration handoff. Recheck Git status before acting: another Claude
session is now working on the merge and may have progressed since this snapshot.

## Scope clarification: preserve both feature sets and meet the PM brief

Read **`docs/MERGE_REQUIREMENTS.md`** before implementing. The user explicitly
clarified that the target is our existing features + Efe's backend/voice features
+ missing PM requirements in one product. One connected journey is a checkpoint,
not the final deliverable. Do not reduce the project to a backend-persona viewer.
The requirement map separates existing source from gaps and gives acceptance checks.

## Latest teammate push: include these changes in the merge

The user clarified: **merge our existing good app with the GCP and ElevenLabs
infrastructure their friend has just pushed**. Preserve the customer UI, stories,
and attention-budget behavior while connecting the existing backend services.

Codex successfully fetched the newer push. The integration target is now
`origin/main` = **`ed5f5cd069b392833cf844a5d03359aa193b9542`**, not `300ad35`.
Two commits were added:

- `4d525ef`: creates the Pub/Sub service agent on fresh projects before granting
  dead-letter permissions (`infra/02_pubsub.sh`).
- `ed5f5cd`: supports an optional server-side `GEMINI_API_KEY` when Vertex AI is
  blocked, including Secret Manager, Cloud Run injection, client selection, and
  the smoke check. The population script skips BigQuery AI.GENERATE in this mode;
  do not claim those SQL-generated messages ran with the API-key fallback.

Inspect them locally with `git log --oneline 300ad35..origin/main` and
`git diff 300ad35..origin/main`. The API/voice routes did not change in these two
commits. If integration already started from `300ad35`, bring both new commits
into that integration branch instead of restarting or discarding ongoing work.
If the team reports another push, fetch again with bounded timeouts; the earlier
advice to avoid repeated fetches only applied to rereading an unchanged snapshot.

## Confirmed by Efe: use Gemini API-key mode

The user's latest message relays Efe's 20:56 update: **Vertex AI is disallowed
in this lab project**, and the team switched to a Gemini API key. Treat this as
the team's required configuration, not merely an optional fallback to investigate.

- Preserve our existing app and integrate the fetched GCP/ElevenLabs backend.
  GCP still supplies Cloud Run, Pub/Sub, Firestore, BigQuery, and Secret Manager;
  only the Gemini model client switches from Vertex AI to Gemini API-key mode.
- Use backend `GEMINI_API_KEY` and the existing `ed5f5cd` implementation. Keep
  Gemini and ElevenLabs keys server-side, in ignored local configuration or
  Secret Manager. No `NEXT_PUBLIC_*` provider keys and no keys in this document.
- The deployment script attaches the Gemini secret only when `GEMINI_API_KEY`
  is present in its environment/configuration. Verify configuration without
  printing secrets; the code change alone does not configure a deployed service.
- GCP authentication is still needed for the data/hosting services. A Gemini key
  does not replace ADC. Do not spend the remaining time trying to re-enable
  Vertex AI when the team has already chosen the supported alternate client.
- The population script skips BigQuery AI.GENERATE in this mode. Describe
  population generation/detection and live Gemini composition separately.
- Keys were supplied in the user's private chat. Codex has not written them to
  files, tested them, or changed cloud configuration during this handoff update.

## Coordination for the active Claude session

- Claude owns merge execution, app moves, code, dependencies, and integration.
  Codex is supporting with this handoff and source review, not a competing merge.
- At the last check, this checkout was still on main `7580d75`, origin/main was
  `ed5f5cd`, and Git listed only this worktree. No merge or `web/` move was visible.
  If current state differs, continue that progress rather than undoing it.
- Read this file and `docs/TASKS.md` first. `docs/HANDOFF_NEXT_AGENT.md` is the
  previous Claude session's historical notes; conflicting network/state claims
  there are superseded by this verified snapshot.
- Preserve current documentation and the dirty lockfile during the merge. Carry
  the latest handoff into any integration checkout; the older committed docs
  alone will not include these updates. No approval is needed just to preserve them.

## Current objective: merge the frontend and existing backend

Latest user direction: update agent context to focus on the merge. Keep the
existing customer experience and build it on the teammate's GCP/ElevenLabs
platform. Do not restart ideation, rewrite either app, or get stuck fetching
code that is already local. Product name remains undecided.

Codex is updating documentation only in this pass. No merge, push, or deployment
has been performed by Codex. The earlier explanation-only/restart snapshot is
history, not the next engineering priority. Push still requires explicit approval.

Success for the first integration: our UI authenticates as one backend customer,
shows their real backend recommendation, persists their response, and uses the
existing audio/voice service with that same identity and context. A folder merge
alone is not done. Continue through feature preservation and missing PM requirements
in `docs/MERGE_REQUIREMENTS.md`; passing this first milestone does not finish the task.

## Exact Git state

- Workspace: `/Users/karahan/Desktop/kbc/tectonic-hackathon`.
- Local main HEAD: `7580d757f26c292829b08e924849c8b567099e18`.
- Remote: `git@github.com:EfeBallar/tectonic-hackathon.git`.
- Fetched origin/main: `ed5f5cd069b392833cf844a5d03359aa193b9542`.
- Independent root histories; ahead 18 / behind 3 is not ordinary linear divergence.
  No merge is in progress. Do not blindly pull/rebase or force-push.
- Before restart preparation, `docs/TASKS.md` and `package-lock.json` were modified;
  `docs/CODE_REVIEW.md` was untracked. Preserve them and the new instruction edits.
- At 20:54, dirty tracked files were AGENTS.md, CLAUDE.md, HANDOFF_TO_CLAUDE.md,
  docs/PROJECT_CONTEXT.md, docs/TASKS.md, and package-lock.json. Untracked files
  were docs/CODE_REVIEW.md and docs/HANDOFF_NEXT_AGENT.md. Recheck before staging.
- Backup: `/tmp/tectonic-restart-20260930-2039/` has `history.bundle`, staged/unstaged
  patches, copies of dirty/untracked files, and a manifest from before these doc
  updates. Ignored credentials/dependencies are not included. Do not restore it
  over newer work unless recovery is needed.

## Backend fetch is complete; Claude connectivity is separate

GitHub API requests timed out. SSH fetch worked with:

```sh
GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1' git fetch --no-tags origin
```

No more network access is needed to inspect the fetched backend:

```sh
git show origin/main:README.md
git show origin/main:kate/api/main.py
git show origin/main:kate/voice.py
git show origin/main:infra/04_deploy.sh
git ls-tree -r --name-only origin/main
```

Do not assume SSH is blocked or retry the old GitHub API loop. The old Claude
session later showed a service connection error; that does not mean the fetched
Git objects are missing or corrupt. A successful Git fetch does not establish
that Claude's service connection is healthy.

## Local app: what exists

- Next.js/React/TypeScript/Tailwind at the root. Customer opens first, KBC scale
  view is a separate tab.
- Five heroes: Noor/scam, Lotte/overdraft, Pieter/idle savings, Maria/duplicate bill,
  Sofie/no interruption. Runner-up recommendations demonstrate the attention budget.
- `lib/population.ts`, `lib/moments.ts`, `lib/orchestrator.ts`, `lib/pass.ts`:
  seeded data, detectors, ranking, weekly budget, aggregation, overrides.
- `lib/demoActions.ts`: in-memory transfers, refund requests, scam resolutions,
  goals, activity, and relevance updates. No real financial transactions.
- 30-day aggregate forecast, explanations, consent/muting, savings visualization.
- `7580d75`: transfer draft -> Send -> checking -> scam pause -> cancel/hold or
  simulated advisor brief. The previous "starts already paused" finding is
  superseded. Fields are scripted and checking is a UI delay, not backend authorization.
- `83bb373`: sensitive-category filtering; do not call this legal-compliance proof.
- The old local TTS/LLM routes exist, but the new scam flow is not connected to
  the teammate's voice-session API.

## Verification and open bugs

Codex ran typecheck, five hero-selection checks, and seven regression checks
through `8aaba50`; typecheck repeated after `f9d0411`. Claude reported the final
scam-opening build green; Codex did not verify that build. Browser unavailable
to Codex. No backend tests or deployed-service checks performed by Codex.

Read the newest section of `docs/CODE_REVIEW.md`. Still needs attention:
second-goal allocated-fund loss; dismissed interruptions not consuming budget;
check-tier scam warning suppression; asynchronous batch cancellation on navigation;
local provider API/number-guard hardening; truthful simulated outcome labels.
Some historical findings are fixed: inspect current code before changing anything.

## Teammate's fetched platform

- Python/FastAPI API + its own detection/contact-policy/Gemini engine.
- Firestore, BigQuery, Pub/Sub, Secret Manager, Cloud Run.
- ElevenLabs read-aloud and conversational agent with authenticated tools.
- Four string-ID personas D001-D004, distinct from local numeric/negative hero IDs.
- Tests/deploy scripts exist. Their presence does not prove deployment or voice works.
- Code defaults to europe-west1; user lab details name us-east1. Verify actual
  deployment/region before provisioning. No credentials belong in this handoff.

### Lab context supplied by the user

- Project ID: `qwiklabs-gcp-02-047bbdce976e`.
- Supplied default region: `us-east1`; zone: `us-east1-d`.
- These are lab defaults, not verification of where existing Cloud Run services
  or BigQuery datasets are deployed. Inspect existing configuration/services before
  changing regions or provisioning replacements.
- Efe supplied an ADC helper URL:
  `https://storage.googleapis.com/cloud-samples-data/adc/setup_adc.sh`.
  Codex has not inspected or executed that script; inspect it before using it.
- Account credentials were shared privately in chat and are deliberately omitted.
  Do not copy the password into instructions, source, commits, or tool output.

Verified source contracts:
- GET /api/demo/personas
- POST /api/auth/demo-login {access_code, customer_id} -> bearer session
- GET /api/me, /api/transactions, /api/spending
- GET /api/nudges
- POST /api/nudges/{id}/respond {response: accepted|dismissed|snoozed}
- GET /api/nudges/{id}/audio -> MP3
- POST /api/voice/session {nudge_id?} -> short-lived conversation credentials/context
- POST /api/demo/events, /api/demo/reset
- Analyst login then GET /api/analytics/overview

Reuse the backend console's voice integration and server-held provider keys.
Customer UI and voice must refer to the same authenticated identity and nudge.

## Wiring details checked directly against origin/main

- Proposed browser configuration: `NEXT_PUBLIC_KATE_API_URL` contains only the API
  base URL. Keep access codes and provider keys out of public build variables.
  Backend `CORS_ALLOWED_ORIGINS` must include the actual frontend origin.
- `GET /api/demo/personas` returns an array with customer_id, profile fields, and
  scripted events. Select a backend ID from this array; do not translate a local
  hero to a backend persona merely because their first names happen to match.
- Demo login returns `{token, expires_in, customer}`. Subsequent customer calls
  use `Authorization: Bearer <token>`. Clear customer data and end voice on logout
  or persona changes. Handle an expired session explicitly.
- `/api/nudges` and `/api/transactions` return arrays, not wrapped objects.
  `/api/nudges/{id}/respond` returns the updated nudge. Accepted feedback does
  not execute the local demo's transfer, hold, refund, or goal actions.
- `/api/demo/events` returns 202: publishing is asynchronous. Refresh/poll nudges
  with a bounded timeout and a visible waiting/error state; do not fabricate a
  live success from a local fixture if the backend has not produced a result.
- Audio needs an authenticated fetch, then a blob URL for playback; a plain
  `<audio src=".../api/nudges/.../audio">` will not carry the bearer header.
  Revoke blob URLs when finished/unmounted.
- Copy the existing console integration in `kate/api/static/index.html`:
  fetch `/api/voice/session`, pass `dynamic_variables` as SDK `dynamicVariables`,
  `language` as the agent language override, and `conversation_token` as
  `conversationToken` with `connectionType: "webrtc"`. The console falls back to
  `signed_url` as `signedUrl` with `connectionType: "websocket"`.
  Request microphone access on the user's click and end sessions on cleanup.
  Check the installed SDK's types while integrating; this is a source contract,
  not evidence the deployed agent works.
- The backend Makefile provides `make test` (unit tests with fakes), while
  `make dev` serves port 8080 and still needs cloud configuration. Do not run
  `make up`, reseed data, or recreate the voice agent merely to inspect the API.
- Live checks still need the existing API URL, working demo access, allowed
  frontend origin, and a configured ElevenLabs agent. Discover these from existing
  local configuration or the teammate; do not paste secret values into this handoff.
  Missing live access does not block the file merge or adapter/unit-test work.

## Integration sequence (not yet executed)

1. Preserve both histories and dirty work in an isolated integration branch/check-out.
   Keep Python deployment layout intact, put Next.js under web/, reconcile
   shared docs/ignore files deliberately. No overwriting or force-pushing.
2. Connect one supported backend journey: login -> profile/history -> recommendation
   -> feedback. Add a small adapter from backend data to UI props.
3. Backend decisions/state should be authoritative for connected journeys. Retain
   the TypeScript mode as explicitly offline/simulated, not a second live policy.
   Carry the full attention ranking, forecast and feedback semantics into the
   connected engine; its current weekly cap/cooldown is not equivalent.
4. Wire the existing audio/session endpoints into the UI; avoid duplicate proxies.
5. Backend detectors cover moving, salary, family, travel, vehicle, cashflow.
   They do not implement our scam preflight/hold flow. Posted transaction events
   are not before-payment authorization. Define a contract or keep that flow simulated.
6. Verify deployment, region, identity, CORS and one full journey before hosting
   the frontend alongside the backend. A file merge alone is not integration.

7. Run backend tests and the frontend typecheck/build from their actual directories;
   check the existing hero stories still work in simulation. Document actual
   environment variables/run commands and any remaining simulated behavior.

Read `docs/HANDOFF_NEXT_AGENT.md` for the previous Claude session's implementation
notes and reported team direction. Preserve that file. Its blanket SSH-blocked
claim is outdated; fetch succeeded. Existing voice endpoints do not establish a
working scam integration: `/api/nudges/{id}/audio` requires a matching backend nudge.

## First action in a fresh session

Inspect git status, confirm both commit IDs, and summarize the state in five lines.
Use the local remote-file reads above; do not redo discovery or long network retries.
Focus the next implementation task on the integration sequence above. Keep the
current working demo safe while connecting one supported journey. Do not spend
the first hour on unrelated feature additions, broad refactors, or another roadmap.
