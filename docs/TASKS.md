# Task board (single source of truth for who edits what)

Lead / integrator: **Claude Code**. Codex: security + docs + review.
**PROPOSAL, not active until the PM picks a concept.** Tasks below assume the Moments candidate in `docs/SPEC.md`; X1-X3 (security) apply to any concept and can start now.

## Rules for both agents

1. Only edit files you own below. Need a change in someone else's file? Write it under "Requests" at the bottom and tell the user.
2. Claude owns `package.json`, `package-lock.json`, `tsconfig.json`. Nobody else runs `npm install` / adds deps.
3. Before every commit: `npm run build` must pass. Commit only your own files (`git add <paths>`, never `git add -A`).
4. `git pull --rebase` before push. Small commits, clear messages, no em-dashes.
5. When you finish a task: tick it here, add one line of what you verified.

## File ownership

| Owner | Files |
|---|---|
| Claude | `lib/population.ts`, `lib/moments.ts`, `lib/orchestrator.ts`, `lib/types.ts`, `lib/actions.ts`, `lib/engine.ts`, `lib/personas.ts`, `app/page.tsx`, `components/**`, `scripts/**`, `package.json`, lockfile, `docs/TASKS.md` (structure) |
| Codex | `app/api/**`, `lib/security.ts` (new), `lib/guard.ts`, `lib/llm.ts`, `lib/prompts.ts`, `next.config.mjs`, `README.md`, `.env.example`, `docs/PROJECT_CONTEXT.md`, `docs/SUBMISSION.md` (new) |

## Claude tasks (P0 then P1)

- [ ] C1 `lib/population.ts` deterministic customer generator + perf measurement
- [ ] C2 `lib/moments.ts` detector library + NOT_DETECTED list
- [ ] C3 `lib/orchestrator.ts` decide(): consent, contact budget, priority, channel
- [ ] C4 `components/ControlRoom.tsx` nightly pass UI with KPIs + throughput
- [ ] C5 phone integration: chosen moment as top card, why-this trace, BOOK_ADVISOR / VIEW_OFFER actions
- [ ] C6 privacy screen with live re-decide
- [ ] C7 advisor brief panel
- [ ] C8 `npm run preview:build` + `docs/index.html` for GitHub Pages

## Codex tasks

- [ ] X1 Security hardening of API routes (see SPEC section 5): new `lib/security.ts` with body size limit (200 KB), same-origin check, in-memory per-IP rate limit (30/min), input validation (question string <= 500 chars, state fields typed/bounded, arrays capped), generic errors. Apply to `app/api/ask` and `app/api/explain`. Delete `app/api/tts` and its references in files you own (report references in Claude files under Requests).
- [ ] X2 `next.config.mjs` security headers (CSP that still allows Next dev + inline styles, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). Verify `npm run dev` page still loads with no CSP console errors.
- [ ] X3 Run `npm audit` and report (do NOT install; put the needed bump under Requests, Claude applies it).
- [ ] X4 `README.md` rewrite per SPEC section 6. Use placeholders like `{{N_CUSTOMERS}}` and `{{THROUGHPUT}}` for numbers until Claude fills them. Include security section + prep boilerplate disclosure.
- [ ] X5 `docs/SUBMISSION.md`: Builderbase description (SPEC 1b template), video script (SPEC 8), checklist. Ready to paste.
- [ ] X6 Review: after Claude ticks C3 and C5, review `lib/moments.ts`, `lib/orchestrator.ts`, `lib/actions.ts` for business-logic / security bugs. Report findings under Requests, don't edit.

## Shared interfaces (Claude defines, others read only)

- `lib/types.ts`: FinState, Insight, ProposedAction, Analysis (existing)
- `lib/population.ts`: `Customer`, `generateCustomer(id, today)`, `toFinState(customer)`
- `lib/moments.ts`: `MomentDetector`, `Detection`, `DETECTORS`, `NOT_DETECTED`
- `lib/orchestrator.ts`: `decide(customer, detections) -> Decision`

## Requests (cross-owner changes, write here)

- Codex intake -> Claude: `AGENTS.md` still says no app/stack exists and points to
  the obsolete planning handoff. Please align it with root `CLAUDE.md`, this board,
  and `docs/SPEC.md`; `docs/PROJECT_CONTEXT.md` is now updated. No app code changed
  by Codex during intake.
- Codex intake -> team: confirm organizer policy on the reported pre-event starter.
  Preserve its provenance; new Git history/disclosure alone does not establish
  permission under the guide's build-during-slot rule.
- Codex intake -> Claude: label linear scale projections as estimates and channel
  routing as simulated unless implemented. Detector counts are not insurance gaps
  actually closed. Respect channel settings even where prototype policy exempts
  protective alerts from commercial consent/contact limits.
