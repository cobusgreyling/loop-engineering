# Loop Configuration — Post-Merge Cleanup (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Post-Merge Cleanup | 1d | L1 report-only | `opencode run "Run post-merge-scan"` via cron (off-peak) |

## Human Gates
- Architectural debt is ticketed, never auto-fixed.
- Denylist paths always human.
- Max 2 fix attempts per run.

## Worktrees
- Use `git worktree` for any code-change attempt (L2+).
- One worktree per fix; discard after REJECT.

## Budget
- Max sub-agent spawns per run: 0 (L1), 2 (L2).
- Run off-peak (evening) to avoid collision.
- Pause if token budget exceeded.

## Links
- Pattern: [post-merge-cleanup](../../patterns/post-merge-cleanup.md)
- Example: [examples/opencode/post-merge-cleanup.md](../../examples/opencode/post-merge-cleanup.md)
- Safety: [docs/safety.md](../../docs/safety.md)
