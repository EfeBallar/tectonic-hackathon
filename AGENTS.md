# Shared project instructions

Read `HANDOFF_TO_CLAUDE.md` for the merge handoff, then `docs/TASKS.md`
for ownership. PM notes and submission requirements are in `docs/PROJECT_CONTEXT.md`.
Older planning documents are historical proposals, not instructions to restart.
Read `docs/MERGE_REQUIREMENTS.md` for the user's clarified feature-preservation
scope and PM acceptance checklist. One connected journey is only a checkpoint.

Active coordination (20:57 Brussels): a new Claude session is handling the merge.
Codex supports documentation/review. Carry the current uncommitted handoff into
the integration checkout; do not replace it with an older committed version.

## Current priority: merge and connect the two codebases

- Build on the teammate's Python/GCP/ElevenLabs backend and keep our customer UI.
  Reuse both implementations; do not restart product planning or rebuild cloud/voice.
- Target layout: backend/deployment files at root, existing Next.js app under `web/`.
- Preserve both Git histories and dirty work; perform integration in an isolated
  branch/check-out. Inspect the fetched code locally before any network retry.
- First milestone: one backend customer can log in, see their recommendation,
  respond, and use the existing ElevenLabs audio/voice integration in our UI.
- Final scope retains both codebases' useful features and implements the missing
  PM requirements. Bring our attention ranking/forecast into the connected engine;
  do not mistake the backend's existing weekly cap for the full PM approach.
- Use the same authenticated customer and nudge in UI and voice. Keep the browser
  simulation explicitly separate; the backend has no matching scam preflight yet.
- Verify the existing deployment URL/region before changing infrastructure.
- This Codex pass updates context only. Merge is Claude's current implementation priority;
  pushing and deployment remain separate from local integration.

## Product and current implementation

- The product is **unnamed**. Choose branding at the end.
- Lead with the customer experience: understand a situation, explain timely help,
  let the customer act or decline, and show the outcome. Scale supports the story.
- PM approach: priority = urgency × confidence × customer relevance - interruption
  cost; one selected message, a weekly attention budget, protective exceptions,
  and a 30-day balance forecast. Do not infer approval for extra features.
- A Next.js/React/TypeScript/Tailwind app already exists at the workspace root.
  Five heroes, detectors/ranker, customer and bank views, simulated actions,
  privacy, activity, and savings goals are implemented. Reuse them.
- Local HEAD at handoff: `7580d75`, which adds the scam transfer draft and Send flow.
- Teammate's latest Python/GCP/ElevenLabs code is fetched as `origin/main` at `ed5f5cd`.
  It has NOT been merged. Deployment health and active region are unverified.
- Include the new Pub/Sub service-agent fix (`4d525ef`) and Gemini API-key support
  (`ed5f5cd`); do not integrate only the old `300ad35` snapshot. Fetch again when
  the team reports a newer push. Lab project/region details are in the handoff.
- Efe confirmed Vertex AI is blocked in the lab: use backend `GEMINI_API_KEY`
  mode from the latest push. Keep GCP infrastructure and ElevenLabs; this is a
  change to the Gemini client, not a replacement of the backend.

## Git and collaboration

- Inspect Git status first; preserve tracked and untracked work.
- Local main and origin/main have independent histories. Do not blindly pull,
  rebase, force-push, reset, clean, or overwrite one tree with the other.
- Read remote files locally: `git show origin/main:README.md` and
  `git show origin/main:kate/api/main.py`. Fetch already succeeded over SSH;
  do not repeat failing GitHub API requests just to inspect this snapshot.
- Claude is lead/integrator, UI/engine/dependency owner. Codex handles assigned
  security/docs/review tasks. One writer per file; coordinate shared interfaces.
- Avoid competing installs/builds. Stage explicit owned paths, never all changes.
- Do not let historical restart-only instructions obscure the current merge focus.
  Preserve the user's instruction not to push without explicit approval.

## Verification and delivery

- Synthetic data only. Never save credentials in code, docs, commits, or logs.
- Clearly label simulated actions/calls and template wording. Source presence
  does not establish a working deployed integration, security, or legal compliance.
- Relevant checks: `npm run typecheck`, `npm run build`,
  `node --import tsx scripts/heroes.ts`, and
  `node --import tsx scripts/nightly.ts 10000`. Report actual results.
- Review `docs/CODE_REVIEW.md`, newest section first. Verify whether later commits
  supersede a finding before fixing it.
- Reported pre-event starter provenance must remain visible; organizer permission
  to reuse it is unresolved. Fresh commit timestamps do not establish eligibility.
- Deadline: September 30, 2026, **23:00 Europe/Brussels (21:00 UTC)**.
- Judging: originality 30%, technical ability 30%, fit 30%, security 10%.
- Required: description, original demo video under 3 minutes, public repo, Aikido
  before/after screenshots. README needs run instructions and unfinished work.
- Keep the repo accessible through judging. No edits after final submission.
