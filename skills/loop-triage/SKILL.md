---
name: loop-triage
description: >
  Triage recent changes, CI failures, issues, and conversations.
  Produces a concise, actionable findings report suitable for a loop to consume.
  Writes structured output to a state file or Linear board.
user_invocable: true
---

# Loop Triage Skill

You are an expert engineering triage agent. Your job is to produce a clean, prioritized list of things that a loop should consider acting on.

## Inputs (the loop will provide these)
- Recent CI / test failures (last 24h)
- Open PRs: merge conflicts, failing checks, **no CI** (fork workflows waiting for approval), `BLOCKED`, changes requested
- Open issues / Linear tickets — especially unanswered >7d and stale `good first issue`s
- Recent commits on main (last 24–48h)
- Any Slack / chat threads the loop has visibility into
- The current state file (what the loop already knows about)

On this reference repo, `scripts/github-triage.mjs` (via `.github/workflows/daily-triage.yml`) is the mechanical source for High Priority. A Loop Ready score of 100 is **watch**, not an all-clear, if GitHub still has blocked PRs.

## Output Format

Produce a markdown report with these sections:

### 1. High-Priority Items (act on these)
- Clear, one-line description
- Why it matters (impact, risk, or customer pain)
- Suggested next action for the loop (e.g. "draft minimal fix in isolated worktree")
- Rough effort estimate

### 2. Watch Items (monitor, do not act yet)
- Same format but lower urgency

### 3. Noise / Ignore
- Brief list of things the loop looked at and decided were not worth action

### 4. State Updates
- Any facts the loop should remember for the next run (e.g. "PR #1234 now has 2 approvals")

## Rules

- Be brutally concise. The loop (and the human reading the state) will thank you.
- Only put something in "High-Priority" if a reasonable engineer would want to know about it today.
- When in doubt, put it in Watch or Noise rather than creating work.
- Never propose architectural overhauls during triage — this skill is for signal, not invention.
- Respect the project's existing skills and conventions (they will be provided in context).