---
name: issue-pr-repair
description: >
  Select and handle one actionable bug report, PR review request, or
  deterministic required-check failure using repair-plan, a repository lease,
  isolated worktree, minimal fix, independent verification, and exact-SHA
  promotion. Use for scheduled issue-first maintenance; CI is evidence, not the
  primary queue.
user_invocable: true
---

# Issue + PR Repair

Run one bounded repair cycle. Never select a target by intuition when a trusted
planner decision is available.

## Inputs

- Repository-specific AGENTS.md and LOOP.md
- repair.yaml and a fresh provider evidence JSON
- promotion.yaml and trusted execution receipts
- Project build/test commands

## Process

1. Collect authoritative open issue/PR state. Treat webhook payloads only as
   wakeups.
2. Run loop gate repair-plan with repair.yaml and the evidence JSON.
3. For idle, exit quietly. For paused, locked, or human-required, report the
   decision and do not mutate anything.
4. Claim only the selected target. Re-fetch exact PR SHA, global lock, attempt
   label, and risk. Stop if any changed. Increment once; cap at three.
5. For diagnosis, reproduce without editing and classify the result.
6. For a code action, create a fresh isolated worktree, reproduce, make the
   smallest relevant change, and add a regression test.
7. Run narrow and affected-package checks. Use a fresh verifier context to
   reject unrelated changes, disabled tests, weak assertions, or sensitive
   paths.
8. Open/update a draft PR and release the lease even on failure.
9. Promotion must bind approval, checks, test deployment, versioned safe data,
   relevant E2E, and acceptance to the current full HEAD SHA. Never merge
   directly.

## Ranking

1. Confirmed bug without a linked PR
2. Actionable review feedback
3. Deterministic required-check failure
4. Diagnosis of an unconfirmed bug or unknown failure

## Mandatory handoff

Security/auth/billing/migrations/deployment/release, flaky infrastructure,
failed reproduction, non-owned PR branches, conflicting/exhausted attempts, and
high/critical risk always go to a human.

## Output

Report the planner decision, lease/attempt, exact reproduction evidence,
changed files, verification commands/results, draft PR, and any human decision
required.
