# Project instructions

## Context

This is a Tectonic Hackathon project. The source brief is
`tectonic-hackathon-participants-guide.pdf`.

Read `docs/PROJECT_CONTEXT.md` at the start of each task for the deadline,
judging weights, submission checklist, and current PM input. That file records
the BuilderBase information supplied by the user after the PDF was read.

Working assumption: we are entering the **KBC challenge**, based on the project
location. The user has not yet confirmed the track, product idea, or stack.
There is no application implementation yet. Do not describe proposals as decisions.

KBC wants a vision and a working proof of concept for scalable personalization:
understand customers' situations, behavior, and intent; respond at the right
moment; support them across products and channels. The brief asks how this could
serve more than 2.3 million customers. Demonstrate one convincing customer
journey and explain how the approach generalizes; do not claim production scale
without evidence.

## Working approach

- Read the relevant files and inspect the current Git state before editing.
- Keep changes focused on the assigned task. Preserve teammates' changes.
- The user's PM friend is preparing answers to the planning questions. Use
  their answers when available; do not invent them or present agent proposals
  as team decisions. Avoid repeating questions already answered in the context.
- Prefer the smallest end-to-end demo that proves the idea. Avoid infrastructure
  or agent orchestration that does not help the demo.
- Follow the iterative build plan in `docs/PROJECT_CONTEXT.md`: one working
  journey first, then short build/check/feedback cycles. Keep scenario data,
  decision logic, and screens separate so PM feedback can change the demo cheaply.
- Use synthetic customer data. Never commit credentials or confidential data.
- Clearly distinguish implemented behavior, mocked integrations, and future work.
- Once a stack is chosen, record actual setup, run, and verification commands in
  `README.md`. Do not invent commands or claim checks passed without running them.
- Check the behavior affected by your changes; report results and limitations.

## Working with multiple coding agents

Codex and Claude Code may work on this repository. These are shared instructions.

- Each task needs an outcome, an owner, permitted files, and a completion check.
- Start with one implementation owner and one reviewer. A reviewer should report
  findings without editing unless assigned a fix.
- Before parallel implementation, agree on shared interfaces and file ownership.
  Do not edit the same files concurrently. Use separate branches/worktrees for
  independent implementations that would otherwise overlap.
- Assign one owner for shared configuration, dependency manifests, lockfiles, and
  integration. Do not run competing dependency installations in one checkout.
- At handoff, summarize changes, checks, unfinished work, and the next task.
- These files provide context; they do not launch agents or synchronize sessions.

## Requirements from the participant guide

- BuilderBase judging weights: originality 30%, technical ability 30%, fit to
  the case challenge 30%, and security 10%.
- Aikido AI Code Audit is required; security contributes 10% of the assessment.
  Capture the baseline screenshot, fix findings, and capture the final screenshot.
- Submit through Builderbase: short description, demo video **under 3 minutes**,
  GitHub repository link, and Aikido before/after screenshots.
- Keep the GitHub repository public and accessible until judging ends.
- Include a short README with the project, run instructions, and unfinished work.
- BuilderBase says hacking has started. Submission deadline: **September 30,
  2026, 23:00 Europe/Brussels (GMT+2 / 21:00 UTC)**. Recalculate remaining time
  from the current clock; do not reuse the pasted countdown as a live value.
- No code changes or submission edits after final submission.

The initial Claude task is in `HANDOFF_TO_CLAUDE.md`; it is a starting assignment,
not a permanent instruction to repeat planning in every session.
