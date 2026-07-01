# Loop Configuration — Changelog Drafter (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Changelog Drafter | 1d or on release prep | L1 draft-only | `opencode run "Run changelog-scan"` via cron (after merges settle) |

## Human Gates
- Breaking changes always human review.
- Security notes / CVEs human must approve wording.
- No tags, no PRs, no publishes without explicit approval.
- First 3 releases: human approves full draft.

## Budget
- Max sub-agent spawns per run: 2 (scanner + drafter).
- Prefer running after merges settle (evening).

## Output Convention
- Draft: `RELEASE_NOTES_DRAFT.md` at repo root.
- State: `changelog-drafter-state.md`.

## Links
- Pattern: [changelog-drafter](../../patterns/changelog-drafter.md)
- Example: [examples/opencode/changelog-drafter.md](../../examples/opencode/changelog-drafter.md)
- Safety: [docs/safety.md](../../docs/safety.md)
