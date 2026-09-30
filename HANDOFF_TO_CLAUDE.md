# Initial handoff to Claude Code

## Where we are

We are starting a Tectonic Hackathon project and will use Claude Code and Codex
to help build it. The user is new to coordinating coding agents and wants a
practical starting point with minimal process.

Codex has read the participant guide and created shared project instructions.
No product, architecture, programming language, framework, or app code has been
chosen or implemented. Inspect the repository again because another session may
have made progress since this handoff was written.

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and
`tectonic-hackathon-participants-guide.pdf` first.
The PDF includes an image-based SD Worx challenge on page 5 that plain text
extraction misses. The working assumption is **KBC**, because this repository is
inside a `kbc` folder; this is not yet a confirmed user decision.

## Your first task: help us choose a buildable MVP

Update from the user: their PM friend is preparing answers to the planning
questions. No answers have been shared yet. Use those answers once available
and focus your contribution on feasibility, scope, and implementation. If the
PM supplies a chosen concept, develop that concept instead of restarting idea
selection. Until then, keep any concept suggestions provisional and brief.

The user supplied a BuilderBase deadline of September 30, 2026 at 23:00
Europe/Brussels (GMT+2). The pasted countdown showed approximately four hours
remaining at capture time; check the current time before budgeting work.
Keep planning short and reserve time for the required submission materials.

The user additionally wants an iterative prototype. Follow the build checkpoints
in `docs/PROJECT_CONTEXT.md`. Spend roughly 10 minutes on the initial proposal,
using rough PM input as soon as it arrives. Do not wait for a polished PM document
or turn this assignment into extensive research. After the team chooses the
customer journey, make the next task a runnable Version 0 rather than more planning.

Produce a concise proposal in `docs/MVP_PROPOSAL.md`. Own that file only for this
assignment. Do not scaffold the application or install dependencies yet: the
purpose of this task is to give the team a concrete product choice.

1. Explain the KBC challenge in plain language. It asks for an approach that
   understands and supports customers through timely personalization, with a
   path to serving more than 2.3 million people.
2. Suggest two or three specific concepts. For each, name the customer situation,
   signals available in a synthetic demo, useful response, and what makes it more
   than a generic banking chatbot.
3. Recommend one concept. Describe the visible customer journey:
   **signal -> interpretation -> personalized support -> customer response**.
   Include a case where a signal is ambiguous and the product asks or refrains
   from acting instead of pretending certainty.
4. Define the minimum working demo, what is explicitly out of scope, and which
   integrations can be mocked. Clearly label assumptions and synthetic data.
5. Propose a simple stack and explain the tradeoff. Treat it as a recommendation;
   account for the team's familiarity and remaining time if those are known.
6. Describe how the approach could scale without building production banking
   infrastructure during the hackathon. Separate demo facts from future design.
7. Give a short build order and an initial division of work between Claude Code
   and Codex. Specify file ownership, shared interfaces, and how we verify each
   task. Begin with one working journey before splitting into parallel features.
8. Outline a demo video under three minutes and retain time for Aikido auditing,
   fixes, screenshots, README, and submission checks.

Ask only questions that materially change the proposal and are not already
answered in `docs/PROJECT_CONTEXT.md` or the PM's input. The deadline is known;
do not ask the user to repeat it. You can prepare the proposal using
explicit assumptions while awaiting answers. Do not treat lack of a reply as
acceptance of your product or stack recommendation.

Finish by telling the user your recommended concept and the next concrete build
task in plain language. Keep the proposal short enough for the team to review
quickly.

## Confirmed guide requirements

- KBC challenge: customer understanding, situation/behavior/intent, adaptive
  personalization, cross-product/channel support, and impact at scale (pp. 3-4).
- Aikido AI Code Audit: connect the repository, run a baseline, fix findings,
  capture before/after screenshots; security is 10% of the assessment (pp. 6-7).
- Builderbase submission: short description, video under three minutes, GitHub
  link, and Aikido screenshots. Judging covers creativity, technical ability,
  fit, and security (p. 11).
- Build in the official time slot; submit one project per team; keep the repo
  public through judging; include a short README with run instructions and
  unfinished work; never upload secrets; no edits after final submission (p. 12).
- The guide also describes ElevenLabs and Cursor credits and Google Cloud access.
  It does not require using all of those tools. Google Cloud credentials described
  in the guide are valid for one week (pp. 8-10).

## Coordination

The PM friend is preparing product/planning answers; the exact questions and
answers have not been supplied. Do not assume they also own BuilderBase
submission, the video, or the security audit without a team assignment.

For now, Claude owns the MVP proposal. Codex should avoid editing that file while
Claude is working. No implementation tasks have been assigned to either agent.
After the team chooses a direction, agree on interfaces and assign separate
files before both agents write code. The user can relay the proposal between
sessions; the sessions do not automatically share their chat history.
