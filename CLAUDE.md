# Claude Code: focus on the merge

Read `AGENTS.md`, then **`HANDOFF_TO_CLAUDE.md`**, then `docs/TASKS.md`.
This is an existing app, not a blank project or a new idea-selection task.

**Latest scope clarification:** read `docs/MERGE_REQUIREMENTS.md`. Merge our features
+ Efe's features + the missing PM requirements into one product. The single
connected journey is a checkpoint, not completion. Preserve the good existing app
and carry its attention ranking/forecast into the backend decision flow.

Handoff refreshed after a successful fetch at 20:57 Brussels. The new Claude session owns the active merge;
Codex is updating docs/review only. Re-read the handoff if this session loaded it
earlier, including the verified API/voice wiring details and dirty-file inventory.

**New push:** `origin/main` is now `ed5f5cd`, with `4d525ef` (Pub/Sub service-agent
setup) and `ed5f5cd` (Gemini API-key support) added after `300ad35`. Include both
in the merge. If you already started from the old snapshot, continue your work
and integrate the newer commits; do not throw away the existing app or your changes.

**Confirmed environment constraint:** Efe says Vertex AI is disallowed in the lab.
Use the backend's `GEMINI_API_KEY` mode from `ed5f5cd`; retain GCP hosting/data and
the existing ElevenLabs integration. Keys stay in private server configuration.

The next build priority is merging our customer UI with the teammate's existing
GCP/ElevenLabs backend. Keep Python deployment files at root and move Next.js to
`web/` in the integration checkout. Start with one connected customer journey:
login -> recommendation -> feedback -> audio/voice. Reuse existing services.

The product remains unnamed. The Next.js demo is at the repository root.
The teammate's separate Python/GCP/ElevenLabs platform is already fetched in
`origin/main`; use local `git show` reads instead of retrying the GitHub API.

The histories are independent and unmerged. Preserve both and all uncommitted
files. The old automatic pull/rebase instruction is superseded.

PM notes: `docs/PROJECT_CONTEXT.md`. Review: `docs/CODE_REVIEW.md`.
`docs/SPEC.md` and `docs/MVP_PROPOSAL.md` are historical proposals, not instructions
to restart, rename, or rewrite the app.

Use `HANDOFF_TO_CLAUDE.md` for the concrete integration sequence and known contract
gaps. `docs/HANDOFF_NEXT_AGENT.md` contains the previous Claude session's additional
notes; its claim that SSH is blocked is superseded by the successful fetch.
Codex's current change is documentation only. Do not push without explicit approval.
