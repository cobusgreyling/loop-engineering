# Loop Configuration — CI Sweeper (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| CI Sweeper | 5-15m | L2 cautious | `opencode run "Run ci-triage" --agent loop-triage` via cron/systemd |

## Human Gates
- Infra / security / payments test failures: do not auto-fix.
- Max 3 fix attempts per item; escalate after.
- No auto-merge without verifier pass.

## Worktrees
- Always dispatch into a git worktree per attempt.
- One worktree per fix; discard after REJECT.

## Budget
- Max sub-agent spawns per run: 3.
- Max auto-PRs per day: 5.
- Early exit if no failures found.

## Links
- Pattern: [ci-sweeper](../../patterns/ci-sweeper.md)
- Example: [examples/opencode/ci-sweeper.md](../../examples/opencode/ci-sweeper.md)
- Safety: [docs/safety.md](../../docs/safety.md)
