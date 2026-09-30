# MVP proposal (Claude, 19:10). A proposal for the PM, not a decision.

## 1. The KBC challenge in plain language

KBC wants the bank to notice what's going on in a customer's life (from signals it already has) and step in at the right moment with the right help, across banking, insurance and investing, in whatever channel fits. It has to work for 2.3M customers automatically, not for a handful by hand. They say explicitly: not another feature, a new *approach* to personalization, shown as a working proof of concept.

## 2. Three concepts

| | A. Moments engine | B. Life-event concierge | C. "What KBC knows about me" |
|---|---|---|---|
| Customer situation | Any: cash crunch, moving, first salary, trip, idle savings, possible fraud | One big event, e.g. moving house | Any customer who wants control over personalization |
| Signals (synthetic) | Transactions, app behavior (e.g. mortgage simulator views), Kate chat topics, products held, consent | Rent deposit, IKEA/Brico spend, new landlord, address search | Same as A, shown to the customer |
| Useful response | One best action per customer per night, or none, routed to app card / Kate / push / advisor | A single coordinated plan: cash for the deposit, home insurance at new address, address change | Customer sees inferences, corrects them ("I'm not moving"), toggles offers; the experience adapts |
| Why it's not a chatbot | It's a decision system over the whole customer base, with a policy (consent, contact budget, priority) and a bank-side control room | Replaces 3 departments contacting you separately with one response | Makes consent and correction the product, not a legal footnote |
| Risk | Broadest; needs a control room plus a phone | Deep, but weak on "2.3M customers" | Strong idea, thin demo alone |

## 3. Recommendation: A, using B as the hero journey and C as the control screen

Each covers another's weak spot: A answers scale, B gives the jury one story they feel, C answers trust and privacy (KBC's marketing director will care).

Visible journey: **signal -> interpretation -> personalized support -> customer response**
1. Signal: Lotte pays a EUR 2,400 rent deposit, spends at IKEA, gets a new landlord transfer.
2. Interpretation: "moving house" detector fires, confidence 0.85, evidence listed.
3. Support: policy checks consent + contact budget, picks one action: cash plan + home insurance at new address + address change in one tap. Big moment, so an advisor also gets an AI-prepared brief.
4. Response: Lotte accepts / dismisses / turns off offers. Dismiss is logged; turning off offers removes the insurance pitch but keeps protective alerts.

**Ambiguous case:** a single IKEA purchase with no deposit or landlord signal gives confidence 0.4. Below the 0.6 threshold, so the engine does nothing, or at most asks a soft question in Kate ("Planning a move?"). The control room shows it as "held: low confidence". Silence is a feature.

## 4. Minimum working demo

In scope:
- Synthetic population generated in the browser from seeds (e.g. 2,000 to 10,000 customers).
- 6 to 10 rule-based detectors with confidence + evidence.
- Decision policy: consent, max 1 non-protective message per 7 days, priority protect > support > guide.
- Control room: "run nightly pass" live, KPIs incl. "no action" and "held by consent", throughput.
- Phone view of one customer that adapts to their chosen moment, "why this, why now", privacy toggle that re-decides live.

Out of scope: real KBC data or APIs, real ML models, auth/SSO, real push/email sending, a production database.

Mocked: all customer data (synthetic, labeled as such), channels (shown, not sent), advisor booking. LLM wording is optional; with no key the demo uses templates, and we say so.

## 5. Stack

The prep boilerplate already at the repo root: Next.js 15 + TypeScript + Tailwind, with a phone UI, a deterministic finance engine and an optional LLM hookup that works without a key. Trade-off: fastest path because it runs today; downside is it's a web mockup, not a native app. Any concept above can reuse it.

## 6. How it scales (demo fact vs future)

- **Demo fact:** we measure the nightly pass over N customers in the browser and show the throughput.
- **Extrapolation (labeled as such):** each customer is independent, so 2.3M is the measured per-customer time x 2.3M, split across workers.
- **Future design:** run detectors as a batch job over the data warehouse, add a streaming path for urgent signals (fraud), a shared policy service feeding every channel, and a feedback loop that tunes thresholds from accept/dismiss rates.

## 7. Build order and split

1. Claude: population generator + 3 detectors + policy, verified with a script (V0 in ~45 min).
2. Claude: phone shows the chosen moment for a selected customer (V1).
3. Claude: control room + privacy toggle (V2).
4. Codex in parallel from the start, on separate files: API security hardening, security headers, npm audit (Aikido prep), README, submission text. Then review Claude's decision logic.

Ownership and interfaces: `docs/TASKS.md`. Verification: `npm run build` green + a smoke script printing decisions per customer.

## 8. Demo video (< 3 min) and delivery time

0:00 the Lotte story · 0:25 run the nightly pass live · 1:15 click 2 or 3 customers, the phone adapts, "why this" · 2:05 privacy toggle: the offer disappears, the fraud alert stays · 2:30 scale numbers + moments we refuse to detect + close.

Times (Brussels): Aikido baseline as soon as code is pushed (~20:30) · feature freeze 22:15 · video, README, screenshots 22:15-22:40 · submit 22:40.

## Questions that change the plan

1. Is the PM's concept close to A/B/C, or something else? If else, send it rough and we adapt.
2. Who records the video and who owns Aikido + Builderbase?

## Scale check for every feature (added 19:25)

The case insists on 2.3M customers, so every feature gets four answers before we build it:

1. **When does it run?** Nightly batch (cheap) or live at the moment (fast, pricier)?
2. **Cost per customer?** Plain code (near free) or an AI call (money, latency)?
3. **Who does it touch?** All 2.3M, or the few % in that moment?
4. **Cost of being wrong?** Annoying (bad offer) or harmful (blocked real payment)?

| Feature | When | Cost/customer | Who | Trade-off |
|---|---|---|---|---|
| Scam protection | Live, at payment time, target < 200 ms | Code: rules + score vs. profile | Only risky payments right now | False alarm blocks a real payment, so pause + explain, customer decides |
| Life moments (salary, address, card expiry) | Nightly batch | Code | All scanned, few flagged | Spam risk, so contact budget: max 1 non-protective message / 7 days |
| AI-written message | After code decided to act | LLM call | Only the few % who get a message | Never on all 2.3M; template fallback |
| Advisor handoff | Big moments | Employee time | Very few | AI-prepared brief keeps calls short |
| Privacy switch | Instant | Near free | Anyone | Fewer offers, more trust |

**Architecture that follows from the PM's "static persona + live state":**
- **Nightly brain:** batch over all customers, updates each customer's baseline profile (static persona) and detects slow moments.
- **Live guard:** at payment time, compares the live state (payee, amount, device, active call, remote-access app, hesitation) with the precomputed baseline. Cheap because the heavy work was done at night.

Demo shows measured throughput on N synthetic customers; 2.3M is an extrapolation and labeled as such.
