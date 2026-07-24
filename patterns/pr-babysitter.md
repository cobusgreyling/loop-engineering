# PR Babysitter Loop

**Goal**: Reduce the human time spent herding pull requests through review, CI, rebase, and merge while keeping the human in the judgment seat.

## Scheduling

**Recommended**:
- `/loop 5m /pr-babysit check` (Grok TUI)
- Equivalent scheduled task or GitHub Action in other environments (every 5–15 minutes during working hours is common).

Many teams run a faster "watcher" loop (2–5m) during active review periods and a slower sweeper overnight.

## Required Skills

- `pr-review-triage` — Understands your project's review norms, required checks, and what "ready to merge" means.
- `minimal-fix` — Produces the smallest possible change that addresses a specific reviewer comment or CI failure.
- `rebase-and-clean` — Safe rebase + conflict resolution patterns for your repo.

## State

Keep a small `pr-babysitter-state.md` (or a Linear board / GitHub project view) with:

- Watched PRs + current status
- Last action taken + outcome
- Human decisions that overrode the loop

Example state entry:
```markdown
- #1234 (feat/auth-refresh)
  Checks: passing (unit, lint)
  Required-check policy: known and satisfied
  Reviews: changes requested by @reviewer
  Mergeability: clean
  Ready to merge: no — changes requested
  Last action: Loop proposed minimal diff for comment X
  Human decision: Approved the diff, asked for one more test
```

## How the Loop Runs (Typical Cycle)

1. Discover open PRs authored by the team (or all PRs the user cares about).
2. For each PR:
   - Run triage skill.
   - Classify checks as passing, failing, pending, or absent/unknown; record
     whether the repository's required-check policy is known.
   - If checks are failing → spawn sub-agent with `minimal-fix` skill to address
     the failure. If pending → wait. If absent/unknown → establish repository
     policy or escalate instead of assuming green.
   - If review comments exist and are actionable → propose minimal patches.
   - If ready (known policy satisfied, required approvals present, no changes
     requested or blocking comments, and no merge conflict) → add "ready to
     merge" label or ping human.
3. For PRs that have been idle too long → suggest close or hand-off.
4. Write concise updates back to the PR and to state.
5. Anything ambiguous or high-risk → surface to human with context.

## Circuit Breaker

This is a fix-capable (L2) pattern, so `loop-init` scaffolds the `loop-guard` skill and a seeded `loop-ledger.json` for it automatically. Run the circuit breaker before each retry attempt on a watched PR:

```bash
npx @cobusgreyling/loop-context --check --ledger loop-ledger.json \
  --budget-from-pattern pr-babysitter --budget-level L2
```

Non-zero exit means the same failure repeated or the attempt cap was hit —
stop and escalate to a human instead of continuing to comment/retry on the
PR. See [docs/safety.md](../docs/safety.md).


## Verification Strategy

- Never let the implementer sub-agent mark its own work "done".
- Use a separate verifier sub-agent (maker/checker) (or a stronger model on higher effort) that must explicitly confirm:
  - The change addresses the comment/failure.
  - No unrelated files were touched.
  - Tests/lint still pass in the worktree.
- The loop only proposes; a human (or an explicit "auto-merge" allowlist for very safe cases) actually merges.

## Human Handoff Points

- High-risk refactors
- Changes touching security, payments, auth, or core infrastructure
- When the loop has proposed > N fixes on the same PR without progress
- When the state file shows the same PR surfacing for several days

## Tool-Specific Notes

**Grok Build TUI**:
- The `pr-babysit` skill (if installed) is designed exactly for this.
- Run with `/loop 5m /pr-babysit check`.
- Use worktree isolation for any fix attempts.
- The skill can call `scheduler_delete` on itself when the watchlist is empty.

**Claude Code**:
- Boris Cherny has publicly described running very similar `/loop 5m /babysit` flows.
- Combine with `/goal` for "keep working on this PR until CI is green and no blocking comments remain".

**General**:
- Expose the state file in the repo or a shared doc so the whole team can see what the loop is doing.
- Make the loop's comments on PRs clearly signed (e.g. "🤖 Loop Engineering — PR Babysitter").

## Failure Modes & Mitigations

- **Loop proposes bad fixes** → Strong verifier sub-agent (maker/checker) + human review gate for anything beyond trivial.
- **Missing checks look green** → Represent zero returned checks as
  `absent/unknown`; a clean/mergeable PR is not ready until repository policy
  is known and all review/check gates are satisfied.
- **Infinite rebase loops** → Limit number of automated rebase attempts per PR.
- **Stale state** → The loop should prune closed/merged PRs on every run.
- **Notification fatigue** → Use selective notifications (only when human action is truly required).

## Cost Profile

| Scenario | Tokens/run | Notes |
|----------|------------|-------|
| No-op (empty watchlist) | ~3k | **Target most runs** — exit early |
| Triage pass | ~80k | PR + CI status scan |
| Fix attempt (L2) | ~250k | Worktree + minimal-fix + verifier |

**Cadence**: 5m–15m · **Tier**: high · **Suggested daily cap**: 2M tokens · **Early exit required**

```bash
npx @cobusgreyling/loop-cost --pattern pr-babysitter --cadence 10m --level L1 --conservative
```

High cadence without early-exit burns tokens fast. Use `loop-budget` skill + `loop-run-log.md`.

## Success Metrics

- Average time from "ready for review" to merge (for PRs the loop touched).
- Number of human comments that were purely "LGTM, loop handled the rest".
- Reduction in "can you rebase?" or "CI is red" pings in Slack/Linear.

Start with one team or one repo. Measure for a week. Then expand.
