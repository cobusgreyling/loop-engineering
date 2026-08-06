# AGENTS.md — Issue + PR Repair

## Loop mode

- Run trusted `repair-plan` before selecting work and obey its one-target result.
- Acquire `loop:repairing` before action and release it during every cleanup.
- Use an isolated worktree and draft PR for code changes.
- Reproduce before editing; add a regression test; use an independent verifier.

## Safety

- Never handle security, auth, billing, migrations, deployment, or release work unattended.
- Never use production data in test acceptance.
- Stop after three attempts or on flaky/infrastructure failures.
- Never merge without current-SHA review, checks, deployment, data, and E2E receipts.
