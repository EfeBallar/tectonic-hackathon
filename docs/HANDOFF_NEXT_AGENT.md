# Handoff to the next agent (written 20:45, deadline 23:00 Brussels, feature freeze 22:15)

## Read first
- `docs/PROJECT_CONTEXT.md`: deadline, judging (originality 30, technical 30, fit 30, security 10), PM notes (latest round 3), GDPR Art. 9 rule.
- `docs/ACTION_PLAN.md`: PM's action plan + status table.
- `docs/CODE_REVIEW.md`: Codex review (R1-R10). R3, R5, R6, R8, R9, R1/R2 fixed; R4 (API hardening) and R7 (partly) open.
- The PDF case: pages 3-4.
- No product name yet: the team decides at the end. Don't add one.

## Two codebases, not merged yet
1. **Local `main` (this checkout), the Next.js frontend + in-browser engine.** 18 commits, **NOT pushed** (user said don't push). Last commit `7580d75`.
2. **`origin/main` (friend Efe's push, commit `300ad35`), the Python GCP + ElevenLabs backend "Kate".** Fetched locally as `origin/main`. **No common history** with local main.
   - FastAPI `kate/api` (public, Cloud Run), `kate/engine` (Pub/Sub consumer: detectors, policy, Gemini composer), Firestore + BigQuery (`sql/population.sql` = 2.3M customers in BigQuery), ElevenLabs TTS `/api/nudges/{id}/audio` and voice agent `/api/voice/session`, infra scripts `infra/*.sh`, `make up`.
   - API for a frontend: see its README "Building your frontend on it" (`git show origin/main:README.md`). Needs `CORS_ALLOWED_ORIGINS=http://localhost:3000`, demo login with access code.
   - Its own 4 personas (`kate/personas.py`), different from our 5 heroes.

## What the user wants now (20:40, in Turkish)
"Go on top of the pushed code, change its frontend, merge everything, use GCP and ElevenLabs, add what the PM asked for that's missing."

## Proposed merge plan (was about to run it; user interrupted, NOTHING executed)
1. Commit or keep Codex's uncommitted doc edits (`AGENTS.md`, `CLAUDE.md`, `HANDOFF_TO_CLAUDE.md`, `docs/TASKS.md`, `docs/CODE_REVIEW.md`) — they are Codex's; ask the user.
2. `git mv` the Next.js app into `web/` (app, components, config, lib, preview, scripts, next.config.mjs, package.json, package-lock.json, postcss.config.mjs, tsconfig.json, .env.example, .gitignore, README.md). Keep `docs/`, `AGENTS.md`, `CLAUDE.md`, pdf at root.
3. `git merge origin/main --allow-unrelated-histories`. Root README/.gitignore/.env.example come from the backend; add a "web/" section to the README; add `.agents/`, `.claude/skills/`, `node_modules`, `.next` to the root .gitignore.
4. In `web/`: add `lib/kateApi.ts` (base URL from `NEXT_PUBLIC_KATE_API_URL`, bearer token from demo login). Wire: "Listen" button on the Kate card and on the scam stop screen (ElevenLabs audio via backend), "Talk to Kate" (voice session, `@elevenlabs/client`), a "Live on GCP" mode that logs in as a backend persona and shows real nudges from Firestore. Keep the in-browser engine as the offline/scale demo.
5. Ideally port the Attention Budget formula into the backend `kate/engine/policy.py` so both agree.

**Need from the team before step 4 can be tested:** has Efe run `make up`? If yes: the kate-api URL and the demo access code. Keys stay in `.env` / `.env.local` only, never in git. The team's GCP login was shared in chat; do NOT write it into any file.

## Network gotcha
Venue Wi-Fi blocks GitHub SSH (port 22). HTTPS works intermittently. Use `https://github.com/EfeBallar/tectonic-hackathon.git`. Network commands only work with the sandbox disabled. Pushing requires the user's explicit OK.

## What the web app does today (all in `web/`-to-be, currently at repo root)
- Two views, switch at the top: **Customer** (default) and **KBC**.
- **Customer view:** 5 hand-written heroes (`lib/heroes.ts`): Noor scam call, Lotte overdraft, Pieter idle money, Maria duplicate bill, Sofie nothing (budget full). Phone (`components/MomentPhone.tsx`) + "Competing for X's attention" race (`components/AttentionRace.tsx`).
  - Scam: transfer draft screen → "Send" → "Checking…" → red stop screen → cancel / 24h hold / simulated handoff to a KBC employee with the brief they see. Hook point for ElevenLabs voice ("Hang up. KBC will never ask you to move money."): the stop screen (`ScamGuard` in MomentPhone).
  - Overdraft card with 30-day forecast chart; "Move €X from savings" with confirm changes balances.
  - Savings game (`components/SavingsGoal.tsx`): life-stage object (car/house/cap/suitcase) fills with animated liquid, coin drop, milestones, monthly slider, full-by date.
  - "Why am I seeing this?" sheet (signals, checks, scoreboard), "What KBC knows" privacy tab (consent toggles, per-moment mute, Art. 9 "Ignored on purpose" list).
  - Taps change in-memory state via `lib/demoActions.ts` (validated amounts), activity log, budget consumption, learned relevance (dismiss ×0.5, act ×1.15).
- **KBC view** (`components/ControlRoom.tsx`, trimmed per user): funnel (customers → moments → shown), attention budget slider 1-5, "what it caught tonight", "what we refuse to detect". Runs 100k / 1M / 2.3M synthetic customers in the browser; numbers appear once at the end (user hated flicker).
- **Engine:** `lib/population.ts` (seeded 2.3M, PM signal model: money/behavior/context/life, static baseline vs live session), `lib/moments.ts` (13 detectors + live scam guard `assessPayment`, 30-day `forecast`), `lib/orchestrator.ts` (Attention Budget: `priority = urgency × confidence × relevance − cost`, weekly budget, scams bypass; `SCORING` + `POLICY` tables are the steering knobs), `lib/sensitive.ts` (GDPR Art. 9 blocklist), `lib/pass.ts` (aggregation).
- Checks: `npm run build` (green at 7580d75), `npm run heroes` (5/5 PASS), `npm run nightly 100000` (~2.5 µs/customer).
- Old boilerplate kept but unused: `components/ClassicApp.tsx`, `lib/engine.ts`, `lib/personas.ts`, `lib/tools.ts`, API routes `app/api/ask|explain|status|tts` (Codex owns hardening, R4 open).

## PM requests still missing
- LLM layer 3 (Gemini writes Kate's text for the winning moment only, sanitize transaction text against prompt injection) — the backend already has a Gemini composer; wire it rather than rebuild.
- Voice (ElevenLabs) in the scam flow — backend has it.
- Channel escalation rule (app card → push → voice → advisor).
- First-time recurring payment notice ("cancel before it runs").
- "Incidents opened lately" signal; big purchase / retirement / kid-to-uni moments; trusted contact with consent.
- Login + server-side ownership checks: the backend has this (token-scoped, IDOR tests).

## Delivery (not started)
- Aikido: user said not yet. Needs the code on GitHub.
- README for judges, video script (<3 min), Builderbase description, before/after Aikido screenshots.

## Working rules the user set
- Don't push without explicit OK. Don't start Aikido yet.
- No product name. Plain, non-AI-slop UI (no emoji chips, no ALL-CAPS labels, no flickering numbers).
- User is terse and stressed; reply short, act fast, report what changed.
- Codex also works in this checkout: agree file ownership (`docs/TASKS.md`) before editing the same files.
