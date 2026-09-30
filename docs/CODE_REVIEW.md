# Code review: customer experience and correctness

## Follow-up: `8aaba50`

This section supersedes the original status below where a fix is verified.
During review, `f9d0411` simplified ControlRoom only; that diff was also inspected
and typecheck passed afterward. It does not change the engine/action results below.
Its labels "kept from scammers" and "Idle money given a goal" still overstate
simulated detection totals as completed outcomes; use "flagged simulated payments"
and "idle savings identified" unless actual action completion is being counted.
The implementation is substantially closer to a working customer experience:
Customer is the default view, KBC is a separate tab, actions apply persistent
in-session patches, and the phone includes an activity list.

Verified again: typecheck passes, five hero-selection checks pass, and seven
targeted regression checks pass:

1. Suggested transfer updates both balances, conserves funds, eliminates the
   forecast shortfall, and consumes a non-protective slot.
2. Reapplying the customer's patch preserves balances and activity after selection
   changes. This does not persist across a browser refresh.
3. Tomorrow's bill affects tomorrow's forecast.
4. Increased-bill evidence and action refer to the same bill.
5. Scam cancellation, delay, and handoff produce distinct logs and resolve the
   original detection. The handoff is explicitly simulated and includes a brief.
6. A first savings goal keeps target, monthly amount, and initial allocation,
   conserving savings plus goal funds for the tested input.
7. Disabling offers removes the customer from stale idle-cash sample membership.

The new 30-day forecast uses aggregated bills, daily spend, and monthly salary.
The old underfunded-transfer and due-day bugs are fixed in the tested cases.
Push-toggle copy now accurately mentions email fallback; channel rules did not
change. The UI no longer promises an unsupported Activity undo.

### Remaining findings and new regression

- **New, medium: replacing a goal loses its allocated funds.**
  `lib/demoActions.ts:53` overwrites `p.goal` without returning the previous goal's
  saved amount to savings. Reproduced: allocate 1,000 from savings to goal A, then
  create goal B with zero initial allocation. Savings + goal total falls from
  12,800 to 11,800. Preserve multiple goals, or explicitly transfer/refund the old
  allocation before replacing it. Goal creation also needs to cap the savings
  deduction to the target, not just cap `goal.saved`.
- **R7 partial:** actions now consume slots, but dismissals do not. A customer
  who was already interrupted can dismiss and receive another card without using
  budget. Consume a slot at the defined delivery event, not only acceptance.
  Also, `AttentionRace.tsx:70` promises the dismissed recommendation drops in the
  ranking, but `decide()` filters resolved IDs out before building the ranking:
  the item disappears. Either show a resolved row or correct that instruction.
- **R5 partial:** check-tier copy is improved, but the ranker still drops a 0.55
  check-tier result at its 0.6 confidence gate. Reproduced again. Resolve how live
  payment checks interact with the generic recommendation threshold.
- **R4 and R10 open:** provider routes, headers config, and number guard are unchanged.
  The guard still accepts invented EUR 2030 and EUR 20 with facts `{balance:0}`.
- **R2 partial:** the demo now has distinct resolutions and a simulated advisor
  brief, but still begins at an already-paused payment. Delayed payment is a log,
  not a pending record with the promised cancellation control. The pause overlay
  can still cover Privacy while the original scam is unresolved.
- **R8 partial:** stale sample removal is fixed. The asynchronous pass still holds
  its starting overrides snapshot, and navigation now unmounts ControlRoom without
  cancelling its scheduled loop. Avoid publishing stale aggregates if another run
  starts after navigation, or when customer state changes while an old run continues.

No browser verification, production build, provider requests, or app-code edits
were performed for this follow-up. Source changes after `8aaba50` need a new check.

---

Reviewed commit `9853fd4` on September 30, 2026. This review describes that
snapshot; other agents may continue changing it. The product remains unnamed.

## Assessment

There is a useful, runnable decision-engine prototype with five explicit customer
stories. The main gap is completing the customer's action and showing a truthful
outcome. The new phone does not use the old starter's action reducer or confirmation
flow. Several buttons therefore report success without changing account state.
More dashboard features will not fix that gap.

Keep the seeded data, detector/ranker separation, evidence explanations, and five
heroes. Finish a scam journey and an overdraft journey before expanding scope.

## Checks actually run

- `npm run typecheck`: passed.
- `node --import tsx scripts/heroes.ts`: all five expected card selections passed.
- `node --import tsx scripts/nightly.ts 10000`: passed; 10,000 synthetic customers
  in 44 ms in this run. This excludes UI, I/O, LLM calls, and real banking data.
- Targeted Node probes reproduced the calculation, channel, guard, and stale-sample
  issues below. Direct calls to ask/explain with malformed JSON threw SyntaxError.
- No provider requests, real financial actions, or deployment performed.
- Browser unavailable in this session; interaction findings are based on event
  handlers and state flow, not a visual walkthrough. Production build not rerun.

The five-hero test checks the selected card type only. It does not verify amounts,
forecast dates, action execution, confirmation, privacy, or persistence.

## Fix first

### R1. Customer actions report completion without executing the simulated action

Priority: high. `components/MomentPhone.tsx:93`, `:97`, `:140`;
`components/SavingsGoal.tsx:58`, `:123`; `app/page.tsx:37`.

Transfers, refunds, and card freezes only set local `done` and adjust relevance.
There is no corresponding balance change, payment/refund record, or card state.
The UI promises undo in Activity, but the new phone has only Home and Privacy.
Savings setup passes only the goal label out of the sheet: target, monthly amount,
and initial allocation are discarded, while the UI claims a payday transfer.
Switching customers remounts the phone and loses local completion/goal state.

Fix: give each supported demo action a typed payload, explicit confirmation where
appropriate, and an actual in-memory customer-state transition. A backend is not
required to make a synthetic demo behave truthfully. Label unfinished actions as
previews. Preserve simulated state across customer switches.

Acceptance: transfer changes both balances and resolves the shortage; a savings
plan retains the exact amount/goal chosen; returning to a customer preserves the
result; any claimed undo exists and reverses it.

### R2. The main scam journey starts at an interruption and ends in placeholders

Priority: high. `components/MomentPhone.tsx:132`, `:159`, `:192`.

There is no editable payment journey preceding the pause. The 24-hour delay button
sets the same cancelled state as Cancel. The employee button only shows a
"Connecting" message, implying a verified call without a connection or brief.
The scam overlay depends on the original detection, not tab or completion state,
so cancellation does not clear it and changing tabs does not remove it.

Fix: model draft -> assessed -> paused -> cancelled/pending/handoff as distinct
states. Demonstrate a simulated employee brief, label the handoff, and provide a
return to the app. Render the payment interruption in the payment flow.

Acceptance: normal and risky payments have distinct paths; cancel and delay produce
different records; the customer can reach privacy/home after completing a choice.

### R3. The overdraft recommendation does not cover the actual deficit

Priority: high. `lib/moments.ts:412`, `:429`.

The renter hero's shortfall is EUR 382, but `projectedGap()` rounds to EUR 380.
Even if the suggested transfer were implemented, the projected balance ends at
EUR -2. Deficits below EUR 5 can round to zero and be missed altogether.

`negativeInDays()` is also off by one for bills: with checking=100, dailySpend=0,
upcomingOutflows=200, billsDueInDays=1, daysToPayday=5 it returns day 2, not day 1.
The loop reports d+1 but applies bills using d >= billsDueInDays.

Fix: calculate exact monetary amounts in cents; any displayed protective transfer
must cover the deficit. Use one consistent day convention for bills and forecasts.

Acceptance: a suggested transfer makes the recomputed minimum balance nonnegative;
a bill due tomorrow affects tomorrow; a small negative balance is still detected.

### R4. Provider-backed routes lack the requested abuse controls

Priority: high before public deployment with credentials.
`app/api/ask/route.ts:36`, `app/api/explain/route.ts:9`, `app/api/tts/route.ts:8`.

The routes parse unbounded JSON and rely on TypeScript casts or shallow presence
checks instead of runtime schemas. There is no application-level rate limit or
access control for provider use. Once keys are configured, callers can repeatedly
trigger paid requests. TTS limits text only after parsing and has no type guard.
Malformed JSON throws out of ask/explain rather than returning a controlled 400.
TTS forwards raw upstream error text. `next.config.mjs` has no planned headers.

Fix: bounded body reads, runtime validation, controlled errors, rate limits and a
deployment-appropriate access policy for paid calls. Coordinate with the teammate
working on ElevenLabs; keep that route rather than deleting their integration.
An Origin check alone is not protection against direct scripted callers.

Acceptance: malformed/oversized requests yield 400/413 without provider calls;
over-limit traffic yields 429; errors reveal no upstream internals.

## Next correctness fixes

### R5. Scam assessment and ranker disagree about what "check" means

Priority: medium. `lib/moments.ts:91`, `:112`; `lib/orchestrator.ts:92`.

The guard has allow/check/pause/block tiers, but its score is reused as detector
confidence and filtered against the general 0.6 confidence threshold. A new payee,
unusual currency, and active call score 0.55: the guard returns check while the
ranker suppresses it as low confidence. For an eligible check-tier result, the
generic action text says the payment was paused even though the pause overlay
requires pause/block. Hand-assigned weights are displayed as risk percentages.

Fix: preserve a distinct live-payment decision, with explicit behavior/copy for
every tier. Do not present an uncalibrated rule score as a probability of fraud.

Acceptance: examples in every tier produce the matching interaction and wording.

### R6. Privacy copy promises a channel policy the code does not follow

Priority: medium. `components/MomentPhone.tsx` Privacy push toggle;
`lib/orchestrator.ts:63` onward.

Push disabled says "Otherwise we only show things inside the app." Reproduced:
push=false, preferredChannel=push, appSessionsLast7=0 routes idle_cash to email.

Fix: make channel permissions explicit and match the copy, including fallback
behavior. Test each preference with permitted and disabled channels.

### R7. The weekly attention budget is a snapshot filter, not a consumed budget

Priority: medium. `lib/orchestrator.ts:84`; `app/page.tsx:37`; `lib/pass.ts:16`.

The engine reads a generated `interruptionsThisWeek` value, but presenting or
accepting a recommendation never increments it. Repeated runs can choose the
same action without using a slot. Feedback changes relevance but records no
delivery/completion state. Dismissal can keep the same card visible until its
score falls far enough. Refreshing resets all feedback and consent overrides.

Fix: either describe this as a single snapshot simulation, or track simulated
delivery time, consumed slots, and dismissed/completed items separately from
learned relevance. Retain that state for the demonstrated journey.

### R8. Consent changes leave stale dashboard customer lists

Priority: medium. `lib/pass.ts:47` and `accumulate()`; `components/ControlRoom.tsx:64`.

Removing a previous decision adjusts counts but never removes its sampled ID.
Reproduced on generated customer 2: disable offers, chosen becomes null and
idle_cash count becomes zero, but idle_cash sample list still contains customer 2.

The batch loop also captures the overrides Map when a run starts. Phone toggles
remain active during a run, so a later batch publishes its older aggregate and
can overwrite a live consent correction. This second issue is established by
closure/state inspection, not browser interaction.

Fix: revalidate sample membership and either freeze edits during a pass or apply
them consistently to the active run. Hero IDs are excluded from population totals;
make that clear if toggling a hero is used to demonstrate changing the totals.

### R9. A detected bill increase can produce a card about a different bill

Priority: medium. `lib/moments.ts:199`, `:204`.

Detection finds the first qualifying increase; the action always uses index 0.
Reproduced with an unchanged EUR 100 bill followed by an increased EUR 160 bill:
evidence names the increased bill, but the card claims the unchanged bill went
up to EUR 100, adding EUR 0 a year.

Fix: carry the matching record from detection into the action or share one selector.

### R10. The number guard accepts invented monetary amounts

Priority: medium before enabling the LLM; legacy provider routes.
`lib/guard.ts:35`.

`checkNumbers('Transfer EUR 2030 and then EUR 20', {balance:0})` passes: any value
2020-2035 is exempted as a year and integers <=31 are exempted as dates/counts.
The same bypass occurs with currency symbols. Sign and semantic meaning are also
not validated. This is not evidence that all AI money statements are grounded.

Fix: distinguish explicit monetary quantities from dates/counts, validate against
typed facts, and retain fallback wording on failure. Do not describe this guard
as prompt-injection protection.

## Additional limitations worth preserving in the README

- The current main phone is deterministic/template-based. The old LLM/API and
  `ClassicApp` code exist but are not wired into the winning-card flow.
- The old `lib/actions.ts:98` reducer accepts negative/non-finite amounts.
  Reproduced MOVE_TO_SAVINGS(-100): checking increases by 100 and savings decreases
  by 100. It is not currently called by the new phone; validate it before reusing it.
- The forecast is to payday using an aggregate bill total, not the PM's proposed
  full 30-day transaction projection. Report that limitation explicitly.
- The first-job CTA promises a 10% plan while the goal sheet defaults to 8% of
  salary. Pass the suggested amount into the sheet so the two views agree.
- Headline throughput times only synchronous generation/detection/aggregation.
  It is a synthetic CPU benchmark, not proof of end-to-end KBC throughput.
- The main page allocates its growing desktop region to the bank dashboard and
  introduces even the live scam hero as "Next morning". That framing conflicts
  with a customer making a payment right now. Lead with the customer's task;
  put the bank view behind an explicit judge/demo control.
- Shared instructions are inconsistent about whether an app exists and whether
  the concept is chosen; the task board has stale completion status. Reconcile
  those facts without inventing PM approval or a product name.

## Suggested next iteration

1. Repair the overdraft math and wire its transfer to real simulated state.
2. Finish the scam start-to-resolution flow with honest simulated handoff wording.
3. Harden the provider routes before exposing credentials publicly.
4. Align consent and budget behavior with what the phone promises.
5. Rehearse those two customer stories, then show the synthetic scale result briefly.

No application code was changed as part of this review.
