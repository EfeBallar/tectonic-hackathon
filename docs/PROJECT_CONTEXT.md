# Shared project context

Read this alongside `AGENTS.md`. Keep confirmed facts separate from suggestions.
Update this file when the user or PM provides new decisions; do not overwrite
their answers with agent assumptions.

## Event and deadline

Source: BuilderBase dashboard text pasted by the user on September 30, 2026.
This is a recorded snapshot, not a live connection to BuilderBase.

- Event: Tectonic Hackathon @ Leuven - Belgium's Biggest Hackathon.
- Dashboard status: hacking has started; attendance check complete (1/1).
- Submission deadline: **September 30, 2026, 23:00 Europe/Brussels**
  (**GMT+2 / 21:00 UTC**).
- Snapshot countdown: 03h 58m 40s. Recalculate remaining time from the current
  clock and the absolute deadline; this countdown is not current.
- Submission items complete at capture: **0/4**.

## Judging

| Criterion | Weight |
| --- | --- |
| Originality | 30% |
| Technical Ability | 30% |
| Fit to the case challenge | 30% |
| Security | 10% |

Build priorities should cover all four: a distinct idea, a working demonstration,
clear evidence of challenge fit, and time for the required security audit.

## Required submission checklist

These items were pending in the dashboard snapshot. Check them off only when
the corresponding item has actually been added to BuilderBase.

- [ ] Video link: original demo video **under 3 minutes**, explaining the solution.
- [ ] Description: a description of the solution.
- [ ] GitHub repository link: repository must be **public** for judge access.
- [ ] Screenshots from the Aikido platform: the participant guide specifies
  before/after screenshots from the AI Code Audit and remediation process.

BuilderBase says all tasks must be finished before submitting. The participant
guide additionally requires a short README with run instructions and unfinished
work, accessible submission links, and a public repo through judging.

The dashboard says items can be updated before the deadline. The guide says
there are no code or submission changes after **final submission**. Prepare and
verify materials before final submission, even if time remains on the clock.

## Team and decisions

- User: coordinating development with Codex and Claude Code.
- PM friend: preparing answers to the planning questions. Exact questions and
  answers have not yet been shared with the agents.
- CORRECTION (user, 19:15): the product is NOT decided. The PM is working on
  it. `docs/SPEC.md` (Moments) is one candidate from an earlier chat;
  `docs/MVP_PROPOSAL.md` is Claude's proposal. `docs/TASKS.md` is a proposed
  split; only its security tasks (X1-X3) are concept-independent.
- Claude owns the population generator, moment detectors, policy, and UI.
- Codex owns security, documentation, and review as detailed in the task board.
- Challenge: KBC. Existing stack: Next.js, React, TypeScript, Tailwind.
- Codex's intake work inspected source and updated context; it has not yet run
  the application or completed the implementation tasks assigned in the board.
- Owners for video, description, audit, and final submission: not assigned yet.

## Incoming starter and implementation status

Source: user-pasted Claude Web conversation and inspected workspace files.

The supplied `kbc-moments/` app has been moved to the repository root by the
active Claude Code session. Run application commands at the root. The original
long app handoff is now `docs/SPEC.md`; root `CLAUDE.md` links the current plan.
Do not unzip another copy over this workspace or initialize another repository.

- Present at intake: phone UI, seeded customers Lotte/Bram/Noah, deterministic
  finance engine, action confirmation, chat/template fallback, optional provider
  adapters, package scripts, and a preview builder.
- Missing at intake: population generator, Moments detector library, orchestrator,
  control room, and consent screen. Claude is building these; read the task board
  and current code rather than treating this snapshot as live status.
- The generated preview HTML was not present at intake. Its build script exists.
- Build, runtime behavior, provider calls, throughput, and security have not been
  verified by Codex in this intake turn. The smoke script prints engine output;
  it is not an assertion-based correctness test.
- No-key behavior means template wording, not a live AI service without a key.
- Submission copy must reflect implemented, checked features and real measurements.
  Linear extrapolation to 2.3M customers is an estimate, not a production-scale
  benchmark. Record workload, environment, and timing boundary.
- Simulated detections/routing do not demonstrate prevented fraud, closed
  insurance gaps, or notifications delivered to real customers.
- The imported named jury roles have not been verified against the guide or
  dashboard; do not present them as confirmed event facts.

### Prep-code provenance

The user reports that the starter was written before the event. The participant
guide requires building during the official slot; permission to reuse prep code
has not been established in the information provided. Preserve/disclose this
provenance. Fresh commits or README disclosure alone do not establish eligibility.
A teammate should check the organizers' policy before relying on the starter as
eligible submission work. This note is not a conclusion that reuse is prohibited.

## PM input

### PM notes, latest (round 3, received ~20:05; supersedes rounds 1-2)

**1. Signals**
- Money: transactions, payees, new payees, blacklisted payees, suspect payees, large
  amounts, recurring charges, new domiciliations, changes in amount, change of usual currency.
- Behavior: app usage, change in app usage trend, time of day, hesitation, repeated attempts.
- Context: device, active phone call, remote-access app, location, card coming to
  expiration, incidents opened by the user lately.
- Life: salary change, new address, new dependents, new loan.

**2. Recognition:** static persona = life + half of money; live state = other half of
money + behavior + context.

**3. Moments**
- **Protecting from scams (hero):** the customer should feel as much confidence as on a
  call with a KBC employee.
- **Stabilising money / overdraft coming:** predict the account going negative before it
  does (domiciliations, spending trends, salary timing); a usual bill higher than usual;
  a domiciliation amount changed; the same bill paid twice in a short span (same amount,
  same beneficiary); signal the first time a recurring payment is about to run so the
  customer can cancel it, then repeat that randomly once in a while.
- **Growing money:** idle money -> savings plans; savings goal; gamify it per customer
  (older: a house/car/object that fills up with % saved).
- **Transitions:** first job or job change (model spending trend change and % of salary
  spent/saved); big purchases like a house or car (show the effect on upcoming spending
  and saving); a baby; retirement; sending a kid to university.

**5. Channel:** app card, push notification, voice (ElevenLabs) or a human advisor.
Decide the rule for escalating from one channel to the next.

**6. Scale:** cheap rules detect signals for everyone; the LLM only runs on flagged
moments. Decide that split.

**7. Trust:** a "Why am I seeing this?" line on every card; customer controls (turn a
moment type off); a trusted contact, only with consent.

**Out-of-the-box idea: Kate's Attention Budget.** Banks treat every notification as
free, so customers ignore all of them, including the one that matters. Each customer
gets a limited attention budget (e.g. 3 interruptions a week). Every moment competes:
`priority = urgency x confidence x relevance(to this customer) - interruption cost`.
Only the top moment is shown; the rest wait or are dropped. Relevance is learned per
customer (ignored savings nudges score lower over time). Scam moments bypass the budget.
The engine runs on a 30-day balance forecast, so "overdraft on the 26th" is found early.
Pitch: new way of thinking ("Kate spends attention like money"), scales like a feed
ranking system, uncrowded UI (one thing at a time).

(Point 4 was not included in the notes received.)

### Status vs PM notes (Claude, 20:05)

Built and running (`lib/moments.ts`, `lib/orchestrator.ts`, UI): scam guard with most
listed signals, card fraud, overdraft coming, bill increase, duplicate bill, idle money
with fill-up goal, first job, raise, moving, new dependent, card expiring, consent
toggles, "why am I seeing this", full 2.3M synthetic pass in the browser.

Next (proposed): replace the fixed 1-per-7-days rule with the Attention Budget formula
and learned relevance; add first-recurring-payment notice, "incidents opened" signal,
big purchase / retirement / kid to uni moments, per-moment-type off switch, trusted
contact, channel escalation rule (app card -> push -> voice -> advisor); make the phone
the hero and the control room a smaller "how it works for 2.3M" panel.
Product name: undecided, chosen at the end.

### Interpretation (Claude, to confirm with PM)

- Structure matches the case: signals -> recognition -> moments.
- Recognition = a slow "static persona" (life + money history) combined with a
  fast "live state" (money + behavior + context right now).
- Emphasis: **scam protection** is the hero moment. Many listed signals are
  scam signals (new/suspect/blacklisted payee, large amount, active phone call,
  remote-access app, hesitation, repeated attempts, unusual time/device/location).
- Goal statement: the app should give the confidence of talking to a KBC employee.

### Still open

- Control room: keep as a secondary "how it works for 2.3M" panel (Claude's proposal), or drop?
- Attention budget size (PM example: 3 interruptions/week) and what "relevance" learns from.
- Channel escalation rule: proposed app card -> push -> voice (ElevenLabs) -> advisor.
- Product name: decided at the end.

## Suggested working order

This is a suggested workflow, not an organizer requirement. The active task board
and Moments spec now refine the generic sequence below.

1. Incorporate the PM's answers into one Moments customer journey.
2. Agree on the minimum demo, interfaces, and separate file ownership.
3. Build and verify that journey end to end using synthetic data.
4. Run the Aikido baseline as soon as there is code to audit; capture it, fix
   findings, and capture the final result. Do not leave the audit to the last minute.
5. Reserve the final 30-45 minutes before the deadline for recording, README,
   submission materials, and link checks. Reduce scope if time is short.
6. Complete all four BuilderBase items, verify them, and submit before the deadline.

Agents should continue useful work within their assigned scope while PM answers
are pending. Do not silently choose a product direction on the team's behalf.

## Iterative build plan

The user wants a prototype that can evolve as PM answers arrive and remain easy
to improve after the hackathon. Prioritize a working, changeable demo over a
large initial specification. The Moments direction is now recorded in the active
instructions; the iterations below guide delivery, not claims of completed work.

Planning reference: September 30 at 19:04 Brussels time, with about 3h 56m to the
deadline. Recalculate time when reading this; shorten scope rather than moving
the deadline or sacrificing submission preparation.

### Minimum input to start a customer journey

Use the first rough PM answers available. A polished document is unnecessary.
Fill these from actual team input; leave unknowns explicit:

- Customer and situation: pending PM input.
- Problem and useful outcome: pending PM input.
- One visible demo moment that proves the idea: pending PM input.

Use those answers to refine the Moments journey. Baseline verification and the
assigned engine work can proceed while answers arrive. Keep later PM feedback
in a short backlog; do not repeatedly restart product discovery.

### Build in small versions

| Version | Deliverable | Completion check |
| --- | --- | --- |
| 0: first journey | One synthetic customer, a signal, an explanation, and a useful response on screen | Team can run it and complete the journey end to end |
| 1: adaptation | Change the customer's input or situation and recompute the response | A second fixture produces an appropriately different result through actual logic |
| 2: uncertainty and control | Explain why a response appeared; let the customer correct an assumption or decline | Ambiguous input does not produce an unjustified confident claim; the correction affects behavior |
| 3: presentation and delivery | Clear demo story, verified run instructions, security fixes, recording, and submission items | All four BuilderBase requirements are accessible and checked |

These are checkpoints, not four independent features to build at once. Adapt
their wording to the PM's chosen concept. Suggested first-journey target:
within 45-60 minutes of choosing that concept.

### Each iteration takes roughly 20-30 minutes

1. Pick one observable improvement and name the judging criterion it supports.
2. Assign a writer, permitted files, and a completion check.
3. Implement the smallest useful change and run the relevant check.
4. Show the result to the user/PM; record what worked and the next change.
5. Keep a known working version. Only take the next task when the demo runs again.

Record short outcomes here or in the implementation PR/task, not in a growing
collection of process documents. Never claim a result was tested when it was not.

### Keep the implementation easy to change

- Separate synthetic scenario data, decision logic, and presentation. Start with
  ordinary files/functions; do not build a framework or plugin system.
- Keep the response shape small and explicit: suggested action, explanation,
  supporting signals, and uncertainty where relevant. Agree on it before two
  agents implement different parts.
- Put any external model or service call behind one replaceable function. Keep
  a clearly labeled fixture/demo mode for reproducible demonstrations.
- If the product needs an AI capability to prove its central claim, implement and
  demonstrate it; a fixture fallback must not be presented as live AI output.
- Store keys outside source control. Keep the README's run commands current.
- Save future integrations and additional customer journeys for after the first
  working demo; revisit them after the event if time does not permit.

### Responsibilities

- PM: supply the customer story and assess whether each demo addresses it.
- Claude: lead/integrator, engine and UI owner under `docs/TASKS.md`.
- Codex: security, documentation, and review under `docs/TASKS.md`.
- User: choose direction with the PM and relay updates between agent sessions.

The task board now records file ownership. Follow it before concurrent edits.
The reviewer reports issues without racing to edit the builder's files. The
user does not need to design an agent orchestration system.

### Submission time budget

- Start the Aikido baseline as soon as meaningful code exists and retain evidence.
- **22:15 Brussels:** stop adding features; focus on bugs, security, and delivery.
- **22:15-22:40:** finish the video under three minutes, description, README,
  public repository/link checks, and audit screenshots. Start these earlier
  whenever an owner is available; audit duration is not guaranteed.
- **22:40 target:** have all materials ready and submit, leaving a buffer before
  the hard **23:00** cutoff. Make no code or submission edits after final submission.

### Current iteration

- Stage: existing starter and Moments roadmap received; PM answers still pending.
- Application: starter source at repository root; runtime not verified by Codex.
- Next outcome: baseline verification and the task board's first implementation
  steps, refining the demo story when the PM's answers arrive.
- Open issues: prep-code eligibility and untested baseline. No dependency or
  runtime failure has yet been established by Codex.
