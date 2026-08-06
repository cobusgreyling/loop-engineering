# Issue + PR Repair Loop

**Goal**: Turn the highest-value actionable bug report, review request, or
deterministic PR failure into one minimal verified draft PR, then promote that
exact revision through a real test environment without letting CI become the
primary work queue.

## Scheduling

- Recommended cadence: every 6 hours.
- Webhooks may wake evidence reconciliation immediately; the schedule repairs
  missed delivery and stale state.
- Early exit is mandatory when the queue is empty, paused, or already leased.

## Required Skills

- `issue-pr-repair` — runs deterministic intake, lease, reproduction, minimal
  change, verification, and handoff.
- `minimal-fix` — smallest diff for one reproduced problem.
- `loop-verifier` — independent scope and test verification.
- `loop-guard` — attempt and stagnation circuit breaker.

## State

`repair-loop-state.md` records the last authoritative snapshot, selected target,
lease/attempt, reproduction command, verification, PR handoff, and escalation.
GitHub labels are the cross-run concurrency state; the file is the audit view.

## How the Loop Runs

1. Collect a fresh trusted issue/PR snapshot. Webhook content is only a wakeup
   hint, never evidence.
2. Run `loop gate repair-plan`. It enforces the kill switch, sole ownership
   lock, sensitive areas, exact attempt labels, and one-target ranking.
3. Prefer a confirmed bug without a linked PR, actionable review feedback, a
   deterministic required-check failure, then diagnosis of an unknown report.
4. Acquire the selected target lease and increment its attempt. A stale SHA,
   changed attempt, existing lock, or attempt 3 stops the run.
5. Diagnose without editing. For a fix, create an isolated worktree, reproduce,
   make one minimal change, and add a regression test.
6. Run narrow tests followed by affected package checks. Independently verify
   scope, assertions, and denylisted paths.
7. Open or update a draft PR, release the lease, and hand the exact HEAD SHA to
   the promotion contract.
8. Promotion requires review, required checks, test deployment, versioned
   synthetic/sanitized data, relevant API/browser E2E, and optional human
   acceptance before compare-and-swap merge.

## Verification Strategy

- Reproduction evidence is required before code edits.
- The implementer cannot approve its own output; use a fresh verifier context.
- Missing or stale checks are unknown, not passing.
- Deployment/data/E2E receipts must match the current full PR SHA.
- New commits invalidate review and execution receipts automatically.

## Human Handoff Points

- Security, authentication, billing, migrations, deployment, or release paths.
- Flaky or infrastructure failures.
- Ambiguous product behavior or a report that cannot be reproduced.
- Non-owned PR branches (proposal-only).
- Conflicting attempt labels or three attempts without verified progress.
- High/critical risk and any path outside the auto-merge allowlist.

## Failure Modes & Mitigations

| Failure | Mitigation |
|---|---|
| Two workers fix different targets | Repository-wide lease label; re-fetch after acquisition |
| Webhook is stale or forged | Re-fetch GitHub/CI/deployment evidence from trusted systems |
| Infinite repair cycle | Exact attempt label + `loop-guard`, maximum three attempts |
| Green CI but broken product | Exact-SHA test deployment with realistic safe data and path-aware E2E |
| PR changes after approval | SHA-bound approval and receipts; compare-and-swap merge |
| Alert noise from irrelevant PRs | Apply sensitive/attempt escalation only after a target is actionable |

## Success Metrics

- Time from actionable bug to verified draft PR.
- Percentage of runs that early-exit without model-heavy work.
- Reproduction-to-fix success rate and attempts per target.
- Promotion failures caught before merge.
- Zero concurrent ownership conflicts, stale-SHA merges, or production-data use.

See the executable [coAligne reference](../examples/coaligne/README.md).
