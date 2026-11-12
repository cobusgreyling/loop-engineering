# AGENTS.md — Changelog Drafter (Opencode)

## Loop Mode
- L1 report + draft for the first 1-2 weeks.
- Read `changelog-drafter-state.md` before every run.
- Human approves every draft before any publish or PR.

## Safety
- Never create tags, GitHub releases, or update CHANGELOG.md without explicit human approval.
- Breaking changes and security items must be surfaced explicitly.
- Draft PRs only when L2 is enabled — never auto-merge.

## Verification
- Verifier checks draft completeness: categories, date range, links.
- Record draft status and human feedback in state.
