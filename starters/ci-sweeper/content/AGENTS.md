# AGENTS.md — CI Sweeper (Opencode)

## Loop Mode
- CI sweeper is L2 from week one (action-oriented — CIs are urgent).
- Read `ci-sweeper-state.md` before every run.
- Classify failures before attempting any fix.

## Safety
- Always dispatch into a git worktree per attempt.
- Infra / security / payments test failures: do not auto-fix; flag and stop.
- Max 3 fix attempts per item; escalate after.
- Enforce budget cap from `LOOP.md`.

## Verification
- Verifier must run tests after implementer.
- Record attempt count in `ci-sweeper-state.md`.
- No auto-merge without verifier approval.
