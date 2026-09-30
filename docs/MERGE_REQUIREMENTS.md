# Combined product: merge requirements

User clarification, September 30, 2026: preserve **our features + Efe's features +
the PM's requested behavior** in one coherent product. Product name is undecided.
A file merge, a backend-persona viewer, or one connected journey is an intermediate
checkpoint, not completion of this scope. Do not silently drop requirements to
declare integration complete; record implementation gaps and any agreed deferrals.

## Source baseline

- Our app: local `7580d75`, Next.js UI, five heroes, synthetic actions, attention
  ranking, 30-day forecast, explanations/privacy, savings visualization, scale view.
- Efe's backend: fetched `origin/main` at `ed5f5cd`. The original `300ad35` added
  64 files / 4,762 lines: Python API/engine, storage, cloud deployment, voice agent,
  SQL population processing, and tests. The next two commits fix fresh-project
  Pub/Sub setup and add Gemini API-key mode. All three commits belong in the merge.
- HTTPS refetch after the user's newer-push report succeeded with no further
  branch updates; SSH timed out on that attempt. Check newer pushes when reported.
- PM requirements were re-supplied by the user and remain the product brief.
  Their full list is in `PROJECT_CONTEXT.md`, under PM notes round 3.
- Vertex AI is blocked per Efe. Use Gemini API-key mode; retain GCP data/hosting
  and ElevenLabs. The existing BigQuery AI.GENERATE stage is skipped in this mode.

## What to preserve and connect

Status below comes from source inspection, not a deployed integration test.

| Capability | Existing source | Required combined behavior / remaining gap |
| --- | --- | --- |
| Customer experience | Our phone UI, five heroes, Customer/KBC views | Preserve the stories, explanations and actionable outcomes. Backend integration must support the product, not replace it with the backend's basic HTML console. |
| Scam protection | Our payment draft, `assessPayment`, pause/check/block tiers, cancellation/hold/advisor demo | Keep the before-payment intervention and protective budget exception. Backend currently consumes posted transaction events; add an appropriate preflight/state contract for a connected synthetic flow. Keep any unconnected flow explicitly simulated. |
| Overdraft forecast | Our 30-day aggregate forecast; backend cashflow detector | Carry salary timing, scheduled outflows and spending trend into the connected forecast. A simple cashflow signal is not equivalent to the existing forecast. Calculations stay deterministic. |
| Bills | Our duplicate-bill, bill-increase and subscription detectors | Preserve same-payee/amount/time-window checks and changed domiciliation amounts. Connect evidence and outcomes to the backend identity. |
| Savings | Our idle-cash detection, goals and filling house/car/object UI | Keep the visualization and planning interactions. Persist connected goals/actions and conserve funds, including when switching/creating goals. No real bank transfers are implied. |
| Life events | Our first salary, salary rise/drop, move and dependent signals; backend moving, salary, family, travel and vehicle detectors | Preserve both sets, including Efe's travel/vehicle behavior. Connect their useful recommendations to our experience rather than deleting them to match five fixtures. |
| Attention Budget | Our urgency × confidence × relevance − interruption cost, ranking and feedback adjustments | Integrate equivalent semantics into the authoritative connected decision path; persist per-customer budget/relevance. Efe's current weekly cap/cooldown alone is insufficient. |
| Voice | Efe's authenticated nudge audio, conversation sessions and scoped tools | Reuse them for the same customer and selected moment shown in our UI. End voice on persona change. A random backend nudge cannot stand in for Noor's scam context. |
| Backend platform | Efe's login, Firestore/BigQuery store, Pub/Sub, Cloud Run, Secret Manager, scoped tools, audit/analytics, tests | Retain these capabilities and deployment structure; reuse existing services/configuration. Preserve authentication and customer ownership checks on newly connected actions. |
| Scale and composition | Our aggregate simulator; Efe's SQL population/detectors and Gemini composer | Cheap deterministic detection/ranking first. Compose only the eligible selected moment; do not call the LLM for every customer or every competing signal. Distinguish measured workloads, simulations and unrun stages. |
| Trust | Our reasons, consent/muting and sensitive-category exclusions; backend reasons, consent/topic policy and authenticated preference tools | Keep a reason on every visible recommendation and persistent customer controls. UI, engine and voice must respect the same preferences. Do not claim the blocklist proves legal compliance. |

## PM requirements that need explicit implementation work

These remain in scope; they are not all implemented merely because both source
trees contain related fields. The integrator should record current status and
prioritize them after the basic connection works, fixing blockers as encountered.

- **Signals/recognition:** carry money, behavior, context and life inputs across
  the schema boundary. Preserve the distinction between a historical baseline
  and live state. Include new/suspect/blacklisted payees, amount/currency changes,
  recurring debits, app-use trend, timing/hesitation/retries, device/location,
  active-call/remote-access context, card expiry, recently opened incidents,
  salary/address/dependent/loan changes. Several are synthetic fields today;
  recent incidents and some events still need model/detector work. Do not imply
  a browser can inspect real calls or installed remote-access apps.
- **First recurring payment:** notice before its first execution, with a useful
  cancel/manage outcome in the synthetic payment schedule. PM also requested
  occasional later reminders; define scheduling within the attention budget.
- **Transition planning:** show salary spent/saved and spending-trend changes for
  first/job changes; project the effect of a house/car purchase; cover baby,
  retirement and a child going to university. Retirement, university and purchase
  impact projections are gaps; a vehicle detector alone does not implement them.
- **Escalation:** define when app, push, voice and a human advisor are used, retain
  relevant context between them, and respect consent. Existing channel selection
  is not a complete escalation workflow. Distinguish delivered channels from a
  prototype preview or recorded callback request.
- **Trusted contact:** explicitly opt in, show what is shared, and support revoke.
  A trusted contact is not automatically authorized by advisor or voice consent.

## Attention Budget acceptance

- Default example: three ordinary interruptions/week, configurable. Score with
  urgency × confidence × customer relevance − interruption cost.
- Show only the winning eligible proactive moment; queue/drop others with reasons.
- Learn per customer from defined feedback. Count ordinary interruptions when
  actually surfaced/delivered, not only when the customer accepts the action.
- Scam protection bypasses the attention budget. Make sure a lower risk check
  isn't accidentally suppressed by a generic ranking confidence threshold.
- Keep 30-day forecasting before detection/selection where relevant. Composer
  wording cannot invent balances, forecast dates, amounts or completed actions.
- Backend `kate/engine/pipeline.py` currently iterates allowed signals and composes
  each. Merely displaying the first returned nudge would not implement a shared
  winner selection policy or the intended LLM cost boundary.

## Implementation order and completion evidence

1. Preserve both histories/work, combine backend root with our app under `web/`,
   and include all fetched commits. Keep the existing app working.
2. Establish one authenticated customer/nudge/action/voice connection. This proves
   the adapter and service access, and is only the first checkpoint.
3. Align authoritative detection, attention ranking, forecast, feedback and
   action state. Preserve the remaining existing customer and backend features.
4. Implement the missing PM items above in the agreed priority order. Keep an
   honest completed/partial/not-built list; obtain an explicit scope decision if
   time requires dropping a requested feature rather than silently omitting it.
5. Verify scam, forecast/bill, savings, life-event and quiet-customer behavior;
   identity/consent consistency across channels; backend tests and frontend build.
   Validate attention suppression and funds conservation with meaningful checks.
6. Record deployment/voice evidence and remaining simulation limits. Complete
   README, video under three minutes, description, public repo and Aikido evidence
   before final submission. Deadline remains 23:00 Brussels.

Claude owns implementation/merge. Codex's current support is documentation and
review; do not start a competing implementation in the shared checkout.
