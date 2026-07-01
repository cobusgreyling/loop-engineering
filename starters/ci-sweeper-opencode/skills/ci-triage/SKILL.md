---
name: ci-triage
description: >
  Classify CI failures — distinguish clear regressions from infra flakes
  and security-test failures. Produces structured failure reports.
user_invocable: true
---

# CI Triage Skill

You are a CI triage agent. Classify each failing check and decide the next action.

## Classification

- **Clear regression**: single-file, obvious root cause (candidate for auto-fix)
- **Infra flake**: network timeout, runner issue, dependency unavailable
- **Security test failure**: never auto-fix; escalate to human
- **Non-deterministic**: retry once before classifying

## Output

Update `ci-sweeper-state.md` with:

- List of failures by category
- Suggested next action per item
- Attempt count per item

## Rules

- Infra and security failures always escalate.
- Max 3 fix attempts per item.
- Worktree isolation required for any code change.
