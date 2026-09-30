# Action plan (PM, received ~20:10)

Verbatim from the PM. Status notes by Claude are in the table at the bottom; the plan text itself is unchanged.

## PHASE 0: Setup (30 min)
- [ ] Public GitHub repo, .env in .gitignore
- [ ] Connect Aikido and run the baseline scan 📸
- [ ] Stack: Next.js + TypeScript + SQLite (one repo, one deploy)
- [ ] Split roles: engine / UI / data + pitch

## PHASE 1: Data (1h)
Script that generates 5 hero customers, hand-written stories:
- 🎓 Student → scam target (fake "KBC advisor" call)
- 🏠 Young renter → overdraft coming on the 26th
- 💼 Mid-career → €4k sitting idle
- 👵 Retiree → duplicate bill + new payee
- 👶 New parent → normal, to show Kate stays silent

The same script generates 10,000 random customers for the scale demo.

✅ Done when you have one JSON or DB file with transactions, payees and recurring debits.

## PHASE 2: The engine (core, 3–4h)
Build it as 3 separate layers. This separation is your scalability story.

**Layer 1: Detectors (cheap rules, run on everyone)**
- overdraftForecast(): projects the balance 30 days ahead from recurring debits and salary date
- scamRisk(): new payee + large amount + active call or remote-access flag
- duplicateBill(): same amount + same payee within X days
- idleMoney(): balance above expenses × 3 for 60+ days

**Layer 2: Attention Budget ranker**
- Scores each moment with the formula `priority = urgency × confidence × relevance − interruption cost`
- Applies the weekly budget, with a scam bypass
- Stores the customer's reactions (acted / dismissed) → updates relevance

**Layer 3: LLM (runs only on the winning moment)**
- Writes the Kate message in the customer's tone plus a "Why am I seeing this?" line

✅ Done when running the engine on the 5 hero customers gives exactly one right card each (none for the parent).

## PHASE 3: UI (2–3h, keep it minimal)
Customer app: 2 screens only
- Home: balance plus max one Kate card, with buttons and a "Why am I seeing this?" link
- Payment flow: the scam interruption appears mid-transfer

Judge view: 1 screen
- "Engine ran on 10,000 customers in X seconds → Y moments detected → Z shown." The gap between Y and Z is the Attention Budget, made visible.

## PHASE 4: Security (do it along the way, not at the end)
- Login, with each customer seeing only their own data. Check it server-side and never trust an ID from the frontend (this is IDOR, Aikido's favorite).
- Actions ("pause payment") are checked for ownership on the server
- ⚠️ Prompt injection: transaction descriptions are user-controlled text, so sanitize them before they reach the LLM. This is a great line for the pitch.
- Rate limit the API, no secrets in the repo
- Rerun Aikido, fix the issues 📸

## PHASE 5: Wow (only if Phases 1–4 are done)
- ElevenLabs: in the scam flow, Kate speaks: "Hang up. KBC will never ask you to move money."
- A slider on the judge view: "Attention budget 1 → 5 per week"

## PHASE 6: Submit (keep 1.5h for this)
- Video under 3 min: problem (20s) → scam demo (60s) → overdraft (30s) → judge view and scale (40s) → security (20s)
- README: what it is, how to run it, what's unfinished
- Before and after Aikido screenshots
- Check every link while logged out

---

## Status vs this plan (Claude, 20:10)

| Plan item | Status |
|---|---|
| Repo, .gitignore | Local repo with commits; `.env*` ignored. GitHub repo exists but is empty: nothing pushed yet |
| Aikido baseline | Not started (needs the push first) |
| Stack | Next.js + TypeScript + Tailwind. **No SQLite / login yet** (see decision below) |
| 5 hero customers | Not yet as hand-written stories. Heroes are currently picked from the generated population |
| Random population | Done, deterministic, **2.3M** (not 10k) run live in the browser |
| Layer 1 detectors | Done: overdraft (to payday, not 30 days yet), scam risk, duplicate bill, idle money + card fraud, bill increase, first job, raise, moving, new dependent, card expiring |
| Layer 2 Attention Budget | Not yet: currently a fixed "1 message per 7 days" + priority. Next task |
| Layer 3 LLM | `lib/llm.ts` exists (Gemini/OpenAI/Anthropic, template fallback); not wired to the winning moment yet |
| Home with one card + "Why" | Done |
| Scam interruption mid-transfer | Done (pause screen, "talk to a real KBC employee") |
| Judge view Y detected → Z shown | Done as the control room; needs trimming to this message |
| Security | Codex assigned: API validation, rate limit, headers. Login/IDOR: see decision |
| ElevenLabs voice, budget slider | Not started (a teammate is on ElevenLabs/GCP) |

### Decision needed: login + SQLite vs. no-backend

Today all customer data is generated in the browser from seeds; **no API returns customer data**, so there is no IDOR surface at all. Adding SQLite + login creates that surface, to then protect it. Options:
1. **Keep no-backend** (faster, zero IDOR by design; README explains what production adds).
2. **Add a thin server:** login as one of the 5 hero customers, server-side ownership check on "pause payment" / actions. About 45 min; gives Aikido real auth code to review.
