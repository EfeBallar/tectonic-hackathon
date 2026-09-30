# CLAUDE.md: Tectonic Hackathon 2026, KBC case (read fully before coding)

You are the main builder for a team at the Tectonic Hackathon (Leuven). **Submissions close 23:00 CEST today.** Work fast, ship working software, commit often. Talk to the team casually and directly. Never use em-dashes in any text you write (UI copy, README, commits).

## 1. The case (verbatim)

> Imagine a future where KBC perfectly understands what customers need and responds at exactly the right moment.
> First, think without constraints. What would the ideal customer experience look like? Then, explore how that experience could be delivered to more than 2,300,000 customers in a scalable way.
> We challenge you not to create just another feature, but to build a proof of concept for a new way in which KBC understands, supports, and guides its customers.
> Consider questions such as:
> 1. What signals can help us understand what customers need?
> 2. How can customers be recognized based on their situation, behavior, and intent?
> 3. How can personalized experiences automatically adapt to each customer?
> 4. How can this work seamlessly across products, services, and channels?
> 5. How can you create meaningful impact for millions of customers at the same time?
> We're not looking for a new feature. We're looking for a vision and a proof of concept for a scalable personalization approach that fundamentally strengthens the relationship between KBC and its customers. Think big. Challenge assumptions. Reimagine how a bank can understand, support, and guide customers at scale.

KBC = banking + investment + insurance. Jury: KBC marketing director, KBC transformation GM, CEO of KBC's startup accelerator.

**Judging (from the Builderbase dashboard):**

| Criterion | Weight | What it means for us |
|---|---|---|
| Originality | 30% | The moments + policy + "silence is a feature" + consent-as-product angle, not a budgeting app |
| Technical Ability | 30% | It must actually run: live nightly pass, phone adapts per customer, no fake screenshots |
| Fit to the case challenge | 30% | Visibly answer the 5 case questions and the "2.3M customers" scale part |
| Security | 10% | Aikido AI code audit score (remaining issues after fixes) |

## 1b. Builderbase submission checklist (0/4 done, deadline Sep 30 2026, 23:00 CEST)

Fields can be updated anytime before the deadline, so fill them early and refine. One team member submits via "Submit Work".

| Required field | Builderbase says | Owner / how |
|---|---|---|
| Video Link | "Submit your original demo video (<3 minutes), explaining your solution" | Team records with the script in section 8, uploads (YouTube unlisted / Loom / Drive with public access), pastes link |
| Description | "Give a description of your solution" | You draft it (template below), team pastes it |
| GitHub Repository Link | "Paste your project's GitHub repository URL. Make sure the repository is public so the judges can access and review your code." | Team creates PUBLIC repo, you keep it pushed and building |
| Screenshots from the Aikido platform | Upload: before and after fixing | Team runs Aikido scan at 20:45 (before) and 21:45 (after), you fix the findings in between |

**Description template (fill with real numbers from the control room before submitting):**

> **Moments: KBC stops running campaigns and starts running moments.**
> Every night, Moments reads each customer's signals (transactions, app behavior, Kate conversations, products, consent), recognizes their situation, behavior and intent, and detects the moment they're in: a cash crunch coming, moving house, a first salary, a trip without travel insurance, idle savings, a possible fraud. A decision policy then picks one best action per customer, or none, respecting consent, a contact budget and a priority order (protect > support > guide), and routes it to the right channel: app card, Kate, push or a human advisor with an AI-prepared brief.
> Our proof of concept runs the nightly pass live over N synthetic customers in X seconds (≈ Y minutes for 2.3M on one core), shows why every decision was made, and lets a customer switch off personalized offers and watch the experience adapt instantly while protective alerts stay on. Code calculates, AI explains, the customer approves.
> Built with Next.js, TypeScript, Tailwind, optional Gemini/OpenAI/Anthropic for wording (works without a key). Security: no customer-by-id endpoints, validated and rate-limited API routes, security headers, action allowlist, LLM number guard.

Repo needs a short README: what it is, how to run, what's unfinished.

**Rules that matter:** project must be built during the hackathon slot (fresh repo, commit history tonight, disclose the prep boilerplate in README). No API keys or secrets in the repo, ever. No edits after final submission.

## 2. What we're building: the Moments engine

**Thesis:** "KBC stops running campaigns and starts running moments. Every customer, every night: one best action, or none."

Pipeline (this IS the pitch, name these layers in UI and README):

```
signals ──► recognition ──► moment detection ──► decision policy ──► channel ──► customer experience ──► feedback
(tx, app,    (situation,      (library of          (consent, contact     (app card,   (adaptive home,       (accepted /
 Kate chat,   behavior,        detectors, each      budget, priority,     Kate, push,  Kate message,         dismissed
 products,    intent)          with confidence      confidence,           email,       advisor brief)        updates rules)
 consent)                      + evidence)          sensitive filter)     advisor)
```

Core principles (keep visible in UI):
- **Code calculates, AI explains, customer approves.** Deterministic engine does all numbers and decisions. LLM only words messages. Nothing executes without the customer's confirm.
- **Silence is a feature.** Contact budget: max 1 proactive (non-protective) message per customer per 7 days. Many customers get "no action" and the control room shows that proudly.
- **Consent is part of the product.** Commercial moments (insurance/investment offers) need `consent.personalizedOffers`. Protective moments (fraud, cash crunch) always allowed.
- **Moments we deliberately don't detect:** pregnancy/health from pharmacy or baby shop payments, religion from donations, relationship breakups, political donations, gambling-based targeting (gambling may only trigger protective help). Show this list in the UI.
- **Humans for big moments:** mortgage/moving/inheritance route to an advisor with an AI-prepared brief, not an automated upsell.

Challenge-assumptions lines for the pitch: personalization = timing + help, not product recs · segment of one instead of static segments · the bank comes to you · one brain, every channel · fewer, better messages · the customer controls their data · AI briefs advisors instead of replacing them.

## 3. What already exists in this repo (reuse it, don't rewrite it)

Next.js 15 App Router + Tailwind v4 + TypeScript. `npm run dev` works. Zero-key "template mode" works.

| File | What it does |
|---|---|
| `lib/types.ts` | All shared types (FinState, Insight, ProposedAction, Analysis, ...) |
| `lib/engine.ts` | Deterministic engine: recurring detection, projection to payday, safe-to-spend, category stats, insights (suspicious payment, cash crunch, spending spike, price increase, idle cash) |
| `lib/personas.ts` | 3 seeded personas (Lotte young pro, Bram freelancer, Noah student) + `applyScenario` live events. `buildPersona` calibrates balance so stories land |
| `lib/actions.ts` | Action allowlist + `applyAction` reducer + `describeAction` for the confirm sheet |
| `lib/tools.ts` | Chat tools: affordability, explain spending, upcoming, move money + regex intent parser |
| `lib/llm.ts` | Provider-agnostic JSON LLM call (Gemini / OpenAI / OpenAI-compatible base URL / Anthropic), plain fetch |
| `lib/guard.ts` | Rejects LLM text containing numbers not in the engine's facts |
| `lib/local.ts`, `lib/runtime.ts` | Browser-only chat fallback + STATIC flag for the single-file build |
| `app/api/ask`, `app/api/explain`, `app/api/status`, `app/api/tts` | API routes (tts = ElevenLabs proxy, can be deleted) |
| `app/page.tsx` | Layout: phone frame (left) + presenter DemoPanel (right) |
| `components/*` | HomeScreen, InsightCard, InsightDetail (+WhyPanel), ActionConfirmation, ChatScreen, ActivityScreen, ProjectionChart, TransactionList, DemoPanel, ui, Icons |
| `scripts/build-preview.mjs` | `npm run preview:build` makes one self-contained HTML (React from cdnjs) in `preview/dist/` |
| `scripts/smoke.ts` | `npm run smoke` prints engine output per persona |

Perf reference: build + analyze one customer (~150 tx) is a few ms in Node. Measure before choosing population size.

## 4. Build plan (in this order, check each off)

### P0 (target done by ~20:45)
1. **`lib/population.ts`**: deterministic parametric generator `generateCustomer(id, today)` for N customers (start N=2000, raise if fast). Reuse the persona generator ideas but parametric: segment (student, first_job, young_pro, family, freelancer, retiree), income, rent, subscriptions, spending propensities, products held (savings, investments, home/car/travel insurance, mortgage), `consent` ({personalizedOffers, channels: push/email/advisor}), `preferredChannel`, `lastContactedDaysAgo`, app intent signals (mortgage simulator views, Kate topics), and randomly injected life events with small probabilities: moving house (IKEA/Brico/Gamma spend, rent deposit "huurwaarborg", new landlord), new car (dealer/garage payment, fuel starts), trip planned (Ryanair/Brussels Airlines/Booking.com), first salary, VAT squeeze, suspicious payment, subscription creep, idle cash, cash crunch. Keep 60 to 90 days history. Must be seeded so the same id always gives the same customer.
2. **`lib/moments.ts`**: `MomentDetector` = { id, label, pillar: "protect" | "support" | "guide", productLine: "banking" | "insurance" | "investment", commercial: boolean, detect(customer, analysis) → { confidence 0..1, evidence: string[] } | null, nextBestAction(customer) → { title, message, cta: ProposedAction, channels } }. ~10 detectors: suspicious payment, cash crunch, subscription creep, spending spike, idle cash → savings/investing, first salary → savings plan, moving house → home insurance at new address + address change + cash plan, new car → car insurance, trip → travel insurance, freelancer VAT squeeze, mortgage intent → advisor. Reuse `analyze()` insights where they exist. Plus `NOT_DETECTED` list (section 2).
3. **`lib/orchestrator.ts`**: `decide(customer, detections) → { chosen: {moment, channel, reason} | null, suppressed: {momentId, reason}[] }`. Rules: confidence ≥ 0.6; priority protect > support > guide, then confidence; commercial requires consent; contact budget (lastContactedDaysAgo < 7 blocks non-protect); channel: protect → push + Kate, big moments (mortgage, moving) → advisor if consented, else in-app card, tie-break preferredChannel. Every suppression has a human-readable reason.
4. **`components/ControlRoom.tsx`** (bank side, replaces DemoPanel as the right/left big panel): "Run nightly pass" button → process customers in chunks (requestAnimationFrame / setTimeout batches) with a progress bar and measured throughput. Then show: KPI tiles (customers scanned, moments detected, actions sent, held by consent, held by contact budget, no action needed), per-moment table (count, acted, top channel, pillar, product line), channel split bar, impact tiles (cash crunches caught early, frauds flagged, € idle cash surfaced, insurance gaps closed), extrapolation "2.3M customers ≈ X min on one core, embarrassingly parallel", and a customer list filtered by clicked moment. Clicking a customer loads them into the phone.
5. **Phone integration (`app/page.tsx`)**: phone shows the selected customer (convert population customer to FinState). The orchestrator's chosen moment appears as the top card (map to `Insight`, extend `InsightKind`). Add action types `BOOK_ADVISOR` and `VIEW_OFFER` to `lib/actions.ts` (with confirm sheet text + activity log). Show a small "Why this, why now" trace: signals, confidence, policy checks passed, suppressed moments with reasons.

### P1 (by ~21:45)
6. **Privacy screen in the phone** ("What KBC knows about me"): signals used, toggle personalized offers / channels. Toggling re-runs `decide` for that customer live: offer disappears, protective alerts stay, control room numbers update. This is the demo's killer moment.
7. **Advisor brief** for mortgage/moving moments: a panel with the customer's situation, evidence, suggested talking points (template, optionally LLM-worded via `/api/explain`).
8. **Security hardening for Aikido** (section 5).
9. **README rewrite** (section 6) + `npm run preview:build` and copy `preview/dist/ahead-preview.html` to `docs/index.html` for GitHub Pages as a live demo link (update the build script if the control room needs it).

### P2 (only if time)
10. LLM-personalized message wording per chosen moment (guarded, fallback to template).
11. Feedback loop: accepted/dismissed actions adjust detector thresholds per customer; show in control room.

## 5. Security requirements (Aikido checks auth, authorization, IDOR, business logic)

- Architecture: synthetic population is generated client-side from seeds. **No endpoint returns customer data by id** (no IDOR surface). State this in README.
- Delete `app/api/tts` (unused key-burning proxy) unless voice is used.
- `/api/ask`, `/api/explain`: reject bodies > 200 KB, validate shape and types (question string ≤ 500 chars, state fields typed and bounded, arrays capped), same-origin check on `Origin`/`Host`, simple in-memory per-IP rate limit (e.g. 30/min), generic error messages (no stack traces), keep action allowlist + number guard.
- `next.config.mjs`: security headers (Content-Security-Policy, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy `camera=(), geolocation=(), microphone=(self)`).
- Actions: `applyAction` must clamp amounts (no negative, not above balance), ignore unknown types. Business logic: freeze/transfer only via confirm sheet.
- `npm audit` and bump `next` to the latest patched 15.x if vulnerable.
- `.env.local` is gitignored. Only `.env.example` is committed.
- README "Security" section: what's protected, and what production would add (SSO for employees, RBAC, customer-scoped tokens, audit log, encryption, GDPR profiling opt-out).

## 6. README (judges read it)
Title + one-line thesis · the ideal experience (short story of one customer) · how it scales (pipeline diagram, moments, policy, channels, throughput numbers) · how it answers the 5 case questions (table) · run it (`npm install && npm run dev`, optional key) · security · what's unfinished · built with (Next.js, Tailwind, optional Gemini/OpenAI/Anthropic) · disclosure: "UI kit and finance helpers came from our own prep boilerplate; the moments engine, population, orchestrator, control room and privacy flow were built during the hackathon."

## 7. Timeline (deadline 23:00)
- 19:00-19:15 unzip, `npm install`, `git init`, first commit, push to a new PUBLIC GitHub repo, `npm run dev`
- 19:15-20:45 P0
- 20:45 push, team runs Aikido baseline scan → screenshot BEFORE
- 20:45-21:45 P1 + fix Aikido findings
- 21:45 push, rescan → screenshot AFTER
- 22:00-22:30 record demo video (<3 min)
- 22:30-22:45 Builderbase: description, video, repo, screenshots. Submit by 22:50. Don't debug at 22:59.

## 8. Demo video script (<3 min)
1. 0:00-0:25 Vision: "Lotte signs a lease. Today her bank finds out three weeks later, from three different departments. With Moments, KBC notices the deposit and the IKEA run, and responds once: cash plan for the deposit, home insurance at the new address, address change in one tap."
2. 0:25-1:15 Control room: run the nightly pass live, read the numbers, point at "no action" and "held by consent".
3. 1:15-2:05 Click 2 or 3 customers from different moments, the phone adapts each time. Open "why this, why now".
4. 2:05-2:30 Privacy toggle: offer disappears, fraud alert stays, numbers update.
5. 2:30-2:55 Scale + guardrails: throughput to 2.3M, moments we don't detect, humans for big moments. Close: "Every customer, every night: one best action, or none."

## 9. Working style
- Commit after every working step with a clear message. Push at the checkpoints above.
- Always keep `npm run build` green. Run it before every push.
- Prefer small, visible, working pieces over ambitious half-done ones. If something risks the timeline, cut it and tell the team.
- Don't break the zero-key template mode: the demo must run with no API key.
