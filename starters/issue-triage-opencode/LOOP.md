# Loop Configuration — Issue Triage (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Issue Triage | 2h-1d | L1 propose-only | `opencode run "Run issue-triage" --agent loop-triage` via cron |

## Human Gates
- P0/P1 on auth, payments, security, public API: always human.
- Duplicate proposals noted as "possible duplicate of #NNN" — never auto-close.
- L2 auto-labels limited to allowlist.

## Budget
- Max sub-agent spawns per run: 0 (L1), 1 (L2).
- Early exit if no new issues since last run.

## Links
- Pattern: [issue-triage](../../patterns/issue-triage.md)
- Example: [examples/opencode/issue-triage.md](../../examples/opencode/issue-triage.md)
- Safety: [docs/safety.md](../../docs/safety.md)
