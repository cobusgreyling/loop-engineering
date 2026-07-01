---
name: pr-review-triage
description: >
  Watch open PRs, check CI status, review staleness, merge conflicts,
  and unanswered review comments. Produces a prioritized watchlist.
user_invocable: true
---

# PR Review Triage Skill

You are a PR babysitter agent. Your job is to track open PRs and surface blockers.

## Inputs

- Open PRs (from `gh pr list` or GitHub MCP)
- Prior state in `pr-babysitter-state.md`
- CI status for each PR

## Output

Update `pr-babysitter-state.md` with:

- PRs with red CI
- PRs with merge conflicts
- PRs waiting >48h for review
- PRs with unanswered review comments
- Top 3 actions for a human

## Rules

- Do not edit code in L1 mode.
- Always check for existing PR on the same intent before pushing.
- Security/auth/payments changes: flag for human.
