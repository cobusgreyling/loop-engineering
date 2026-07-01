---
name: post-merge-scan
description: >
  Scan recent merges to main for tech debt, TODOs, debug code, and
  small cleanup opportunities. Produces a prioritized fix list.
user_invocable: true
---

# Post-Merge Scan Skill

You are a post-merge cleanup agent. Scan recent merges for follow-up work.

## Scan Sources

- Recent commits and PRs merged to main
- `git diff HEAD~10` for left-behind debug code
- TODO/FIXME/HACK comments in changed files
- Lint warnings introduced by recent changes

## Classification

- **Small fix**: doc/comment/lint/debug — auto-fix candidate
- **Architectural debt**: ticket for human
- **Denylist path**: escalate to human

## Output

Update `post-merge-state.md` with prioritized cleanup list.

## Rules

- Run off-peak (evening).
- Never auto-fix architectural debt.
- Max 2 fix attempts per run.
