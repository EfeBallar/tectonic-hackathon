# Ahead with Kate (Tectonic 2026, KBC track starter)

A proactive banking assistant prototype. Banking apps tell you what happened; this one tells you what's about to happen, explains why, and lets you act before it's a problem.

**Code calculates. The AI explains. You approve.**

- The finance engine (plain TypeScript) does every number: recurring bills, spending spikes, balance projection to payday, safe-to-spend, affordability, fraud signals.
- The LLM only turns those numbers into human sentences and picks from actions the engine already allowed.
- A guard rejects any AI answer that contains a number the engine didn't produce, and falls back to a template sentence.
- Nothing touches money until the customer taps Confirm, with a before/after preview.
- Works with **no API key at all** (template mode), so the demo can't die on bad wifi.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY (or OPENAI / ANTHROPIC)
npm run dev                  # http://localhost:3000
```

Deploy for a judge link: `npx vercel`, then add the same env var in the Vercel dashboard. No database needed, all state lives in the browser.

No-install version: `npm run preview:build` writes one self-contained HTML file to `preview/dist/` (engine + template wording, no server). Double-click it or host it anywhere. Good backup if the venue wifi dies.

Other scripts: `npm run build`, `npm run typecheck`, `npm run smoke` (prints every persona's insights + sample chat answers in the terminal, handy for checking the engine without the UI).

## 90-second demo script

The right-hand panel is your presenter cockpit.

1. **Lotte, home screen.** "Safe to spend until payday: €0. Her annual home insurance lands in 6 days and she'll dip under her €500 buffer." Tap *Why?* to show the explanation, the *Why am I seeing this* panel and the raw numbers.
2. **Tap "Move €150 from savings".** Show the consent sheet with the before/after impact. Confirm. Safe-to-spend and the chart update live. Activity tab shows "Approved by you".
3. **Live event: Suspicious payment.** A red card appears on top. "Not me: freeze card" → confirm. Card frozen, dispute logged.
4. **Kate tab.** Tap "Can I afford a €650 trip to Barcelona this weekend?" → *Not yet*, with the real numbers and a fix. Then "Can I afford it next month instead?" → it remembers the trip and says yes. Tap *Show the maths*.
5. **Switch to Bram** (freelancer): VAT and social contributions are coming, yet €1,250 is sitting idle. Same engine, different customer.
6. Close with the guard: "every number Kate says is checked against the engine. If the model invents one, we throw its sentence away."

## How a chat message flows

```
question ──► intent (LLM, regex fallback) ──► engine tool (numbers, allowed actions)
                                                   │
          confirm sheet ◄── buttons ◄── LLM wording ◄┘  (guard: numbers must match facts,
                                                        actions must be in the allowlist)
```

## Where to change what

| You want to | Edit |
|---|---|
| Colors | `app/globals.css` (`@theme` tokens) |
| Product/assistant name, tagline, chat suggestions | `config/app.ts` |
| Customers and their "story" | `lib/personas.ts` (seeded, deterministic) |
| Live demo events | `SCENARIOS` + `applyScenario` in `lib/personas.ts` |
| Insight rules and wording | `lib/engine.ts` (`crunchInsight`, `spikeInsights`, `priceInsight`, `idleInsight`, `suspiciousInsights`) |
| Chat tools (affordability, spending, upcoming, move money) | `lib/tools.ts` |
| What actions exist + what they do | `lib/actions.ts` (`ALLOWED_ACTIONS`, `applyAction`) |
| Prompts | `lib/prompts.ts` |
| LLM provider | `.env.local` (`GEMINI_API_KEY`, `OPENAI_API_KEY` + optional `OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `LLM_MODEL`) |

## If the actual KBC challenge is different

The skeleton is: **data → deterministic insight → explained card → approved action**. Swap the skin, keep the machinery.

| Challenge smells like | Do this |
|---|---|
| Fraud / scams / trust | Promote `suspiciousInsights` to the hero. Add rules (new IBAN + urgency, spoofed "KBC" SMS pasted into chat, first payment to crypto exchange). Chat tool: "is this message a scam?" returns risk facts + reasons. |
| SME / entrepreneurs | Start from Bram. Add tools: VAT reserve (21% of incoming invoices), late-paying clients, cash runway in weeks. Actions: set aside VAT, send payment reminder. |
| Financial literacy / young people | Start from Noah. Explain concepts with the customer's own numbers ("your Spotify + Disney+ = X/year"). Add a goal coach and a weekly recap card. |
| Customer service / Kate itself | Keep the chat, add tools for card/limit/insurance questions returning structured facts, and hand-off to a human with a pre-filled summary. |
| Sustainability / ESG | Map categories to CO₂ factors in the engine, same cards: "transport emissions up 30%", action: set a goal, compare train vs car. |
| They give you a dataset/API | Write a loader that returns `FinState` (see `lib/types.ts`) and use it instead of `buildPersona`. Everything else keeps working. |

## 4-hour plan (18:00 → 22:30)

- **18:00-18:25** Read the case twice. Pick ONE killer interaction and one customer. Decide what to cut.
- **18:25-19:00** Reskin names/colors, write the persona story for their case, stub the new insight.
- **19:00-20:30** Build the one new engine rule + card + action. Happy path must work end to end by 20:30.
- **20:30-21:45** Polish the demo path only. Record a backup screen video of the demo.
- **21:45** One person stops coding: submission form, pitch, deploy link.
- **22:15** Submit. Don't debug at 22:29.

Roles: product/pitch · frontend · engine/AI · glue (data, deploy, testing, helps the bottleneck).

## Pitch skeleton (2 min)

1. **Problem (15s):** people find out about money problems after they happen.
2. **Solution (15s):** Kate warns you before, explains why, and fixes it with one tap you approve.
3. **Demo (60s):** steps 1 to 4 above.
4. **Why KBC (20s):** builds on Kate's move to agentic AI with explicit customer approval; trust is a feature, not a slide.
5. **Feasibility (10s):** deterministic engine + any LLM + consent layer. Could plug into Kate's existing data.

## Honest limits

Synthetic data only. Predictions are simple (median intervals, 60-day averages). No auth, no persistence, no real payments. Voice input uses the browser's speech recognition (Chrome/Edge); read-aloud uses ElevenLabs if `ELEVENLABS_API_KEY` is set, otherwise the browser voice.
