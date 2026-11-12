# AGENTS.md — Dependency Sweeper (Opencode)

## Loop Mode
- L2 assisted from week one (patch-only with strong verifier gates).
- Read `dependency-sweeper-state.md` before every run.

## Safety
- Patch-only by default. Majors and breaking changes escalate to human.
- Maintain denylist in state file — never touch those packages.
- One worktree per update attempt.
- Max 3 fix attempts per run; max 5 auto-PRs per day.

## Verification
- Verifier must run `npm ci && npm test` (or equivalent).
- Record attempt count and test evidence in state.
