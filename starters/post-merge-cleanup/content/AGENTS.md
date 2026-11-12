# AGENTS.md — Post-Merge Cleanup (Opencode)

## Loop Mode
- Start in L1 report-only mode.
- Read `post-merge-state.md` before any scan.
- Run off-peak (evening) to avoid colliding with active branches.

## Safety
- Never auto-fix architectural debt — file a ticket.
- Denylist paths always go to a human.
- Max 2 fix attempts per run.

## Verification
- For L2+ changes, verifier confirms fix scope and tests.
- Record attempt evidence in state.
