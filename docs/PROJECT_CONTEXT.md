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
- Claude's initial assignment: a brief MVP proposal, adjusted to the PM's input.
- Codex: has prepared shared instructions and the Claude handoff; no application
  implementation has been assigned yet.
- Challenge track: KBC is a working assumption based on the folder location.
- Product concept and technology stack: not chosen in the context received so far.
- Owners for video, description, audit, and final submission: not assigned yet.

## PM input

**Awaiting the PM's actual answers.** The user can paste their message into either
agent session and ask that agent to record it here. No special format is needed.

When answers arrive, preserve the PM's meaning and record whatever is supplied:
the chosen challenge, target customer, problem, proposed experience, demo story,
must-have scope, and exclusions. These are optional organizing fields, not a new
questionnaire the PM must complete. Mark any remaining unknowns explicitly.

## Suggested working order

This is a suggested workflow, not an organizer requirement or a decided stack.

1. Incorporate the PM's answers and choose one customer journey.
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
large initial specification. This is a proposed delivery plan, not a claim that
the product or implementation has been approved or completed.

Planning reference: September 30 at 19:04 Brussels time, with about 3h 56m to the
deadline. Recalculate time when reading this; shorten scope rather than moving
the deadline or sacrificing submission preparation.

### Minimum input to start a customer journey

Use the first rough PM answers available. A polished document is unnecessary.
Fill these from actual team input; leave unknowns explicit:

- Customer and situation: pending PM input.
- Problem and useful outcome: pending PM input.
- One visible demo moment that proves the idea: pending PM input.

Once those are clear, select the smallest implementation and start. Keep later
PM feedback in a short backlog; do not repeatedly restart product discovery.

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

### Proposed responsibilities

- PM: supply the customer story and assess whether each demo addresses it.
- Claude: recommended first implementation owner once the concept is chosen.
- Codex: recommended reviewer/tester, then owner of a separately assigned task.
- User: choose direction with the PM and relay updates between agent sessions.

These are proposed responsibilities, not evidence that another session has
accepted a task. Confirm file ownership through the user's task messages before
concurrent edits. The reviewer reports issues without racing to edit the
builder's files. The user does not need to design an agent orchestration system.

### Submission time budget

- Start the Aikido baseline as soon as meaningful code exists and retain evidence.
- **22:15 Brussels:** stop adding features; focus on bugs, security, and delivery.
- **22:15-22:40:** finish the video under three minutes, description, README,
  public repository/link checks, and audit screenshots. Start these earlier
  whenever an owner is available; audit duration is not guaranteed.
- **22:40 target:** have all materials ready and submit, leaving a buffer before
  the hard **23:00** cutoff. Make no code or submission edits after final submission.

### Current iteration

- Stage: awaiting the first PM product answers; shared context is ready.
- Working application: none yet.
- Next outcome: select one customer journey and turn it into the Version 0 task.
- Current development blocker: customer story not yet supplied; no runtime or
  dependency blockers have been tested.
