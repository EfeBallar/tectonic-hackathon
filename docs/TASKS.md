# Current task board

**Current priority: merge our features and the teammate's GCP/ElevenLabs features,
then complete the missing PM requirements in one product.**
Use `MERGE_REQUIREMENTS.md` as the preservation/acceptance checklist. One connected
customer journey and voice prove the first connection, not completion of the scope.

Refetched for the active Claude merge at 20:57 Brussels, September 30. Read
`../HANDOFF_TO_CLAUDE.md` first. Product name remains undecided.

## Ownership

| Owner | Scope |
| --- | --- |
| Active Claude session | Merge lead; app relocation, frontend/backend adapter, voice, dependencies, build config |
| Codex | Assigned security/API work, docs, review, regression checks |
| Teammate | Python/GCP/ElevenLabs platform and cloud setup; deployment health unverified |
| PM/user | Customer experience, story, scope, naming, submission decisions |

One writer per file. Coordinate shared interfaces and dependency changes.
Preserve the uncommitted lockfile and review/docs. Do not run competing builds.

## Git

Local main `7580d75` and fetched origin/main `ed5f5cd` have independent histories.
**No automatic pull/rebase.** Read remote files with local git show. Integration
has been explained, not executed. Preserve both histories and dirty work.
Use explicit owned paths when staging; no force-push or destructive resets.
The latest fetch added `4d525ef` (Pub/Sub setup) and `ed5f5cd` (Gemini API-key
support). Include both; earlier handoffs targeting only `300ad35` are stale.

## Implemented locally

Seeded population, five heroes, detectors/ranker, attention-budget settings,
30-day aggregate forecast, Customer/KBC views, in-memory actions/activity/goals,
consent/muting, scam draft/Send/check/pause and distinct resolution options.

This is implementation status, not proof every edge case passes. The prior
unchecked C/X roadmap and blank-project assignment are superseded.

## Open work

- [ ] Preserve dirty work and both histories; prepare an isolated integration branch.
- [ ] Combine backend root with the existing Next.js app in `web/`; reconcile configs.
- [ ] Ensure the integration includes latest origin/main `ed5f5cd`, including both
  new infra fixes, even if the merge was started from `300ad35`.
- [ ] Verify existing API URL/region and define data, identity, and decision ownership.
- [ ] Use Gemini API-key mode as Efe confirmed Vertex AI is blocked. Verify
  server-side configuration/Secret Manager without exposing keys; keep GCP data
  services and ElevenLabs intact. Do not claim BigQuery AI.GENERATE ran in this mode.
- [ ] Connect login -> recommendation -> persisted feedback for one backend persona.
- [ ] Integrate that journey with existing ElevenLabs audio/session APIs.
  Live scam preflight needs a backend contract not currently present.
- [ ] Verify the connected journey, backend tests, frontend build/typecheck, and
  existing offline heroes; update run instructions. This is the first milestone.
- [ ] Integrate our full attention ranking, 30-day forecast, per-customer feedback
  and protective exceptions into the connected engine; preserve Efe's detectors,
  storage, analytics and voice/tool features. A cap alone is not Attention Budget.
- [ ] Track and complete PM gaps from MERGE_REQUIREMENTS.md: first recurring-payment
  notice, incidents signal, transition projections, escalation and trusted contact.
  Mark partial/not-built behavior explicitly; do not silently remove requirements.
- [ ] Then address remaining PM requirements and demo-blocking review findings:
  second-goal fund conservation, dismissed-message budget semantics, check-tier
  warning suppression, asynchronous population-run cancellation. Recheck against
  current commits before editing; fix integration/security blockers as encountered.
- [ ] Decide which provider routes remain; validate/rate-limit those routes.
  Preserve TTS while the teammate integrates voice; avoid duplicate auth designs.
- [ ] Complete applicable API/security checks and dependency audit.
- [ ] Verify cloud health/region and frontend hosting within the user's task.
- [ ] Rewrite README around the actual combined result, limitations, and measured numbers.
- [ ] Prepare description, video under 3 minutes, Aikido screenshots, public links.

## Evidence

Codex: typecheck, five hero checks, seven targeted fix checks through 8aaba50;
typecheck repeated at f9d0411. Later scam-opening build reported green by Claude,
not independently verified by Codex. No browser/cloud verification by Codex.
Teammate's source fetched and inspected. See CODE_REVIEW.md for evidence.

PM notes: PROJECT_CONTEXT.md and ACTION_PLAN.md. Older proposals are historical.
This task board does not instruct agents to perform unassigned work.
