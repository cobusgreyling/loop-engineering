# Loop Configuration — Dependency Sweeper (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Dependency Sweeper | 6h | L2 patch-only | `opencode run "Run dependency-triage" --agent loop-triage` via cron |

## Human Gates
- Major version bumps always human.
- High-severity CVE requiring breaking change: human.
- Denylist packages (edit in state) never auto-touched.
- No auto-merge without verifier pass.

## Worktrees
- One worktree per package update attempt.
- Discard on REJECT or human escalation.

## Budget
- Max sub-agent spawns per run: 3.
- Max auto-PRs per day: 5.
- Pause if token budget exceeded.

## Links
- Pattern: [dependency-sweeper](../../patterns/dependency-sweeper.md)
- Example: [examples/opencode/dependency-sweeper.md](../../examples/opencode/dependency-sweeper.md)
- Safety: [docs/safety.md](../../docs/safety.md)
