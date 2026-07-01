# Loop Configuration — PR Babysitter (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| PR Babysitter | 10-15m | L1 report-only | `opencode run "Run PR babysitter triage" --agent loop-triage` via cron/systemd |

## Human Gates
- No auto-fix until L2 checklist complete.
- Draft PRs by default; humans mark ready for review.
- Do not resolve review threads without approval.
- Security, auth, payments, infra changes: always human.

## Worktrees
- One worktree per fix attempt; discard after verifier REJECT.
- Run implementer with `--dir <worktree>`.

## Budget
- Max sub-agent spawns per run: 0 (L1).
- Max 3 fix attempts per PR before handoff.
- Pause if token budget exceeded.

## Links
- Pattern: [pr-babysitter](../../patterns/pr-babysitter.md)
- Example: [examples/opencode/pr-babysitter.md](../../examples/opencode/pr-babysitter.md)
- Safety: [docs/safety.md](../../docs/safety.md)
