# Loop Configuration — Issue + PR Repair

| Pattern | Cadence | Status |
|---|---|---|
| Issue + PR Repair | 6h + webhook reconciliation | L2 assisted |

## Queue and ownership

- Issues and actionable PR feedback are the primary queue; CI is evidence.
- `loop gate repair-plan --contract repair.yaml --evidence <snapshot>` selects
  zero or one target.
- `loop-pause-all` stops every run; `loop:repairing` is a repository-wide lease.
- Maximum three attempts. Use one isolated worktree per code-changing attempt.

## Verification and promotion

- Reproduce before editing and add a regression test.
- Use a fresh checker context; the implementer does not approve itself.
- Open draft PRs. Never bypass `promotion.yaml` or merge a stale SHA.
- Test data must be versioned synthetic or sanitized data, never production.

## Human gates

- Security, auth, billing, migrations, deployment, and release work.
- Flaky/infrastructure failures, ambiguity, failed reproduction, and attempt 3.
- High/critical risk or any path outside the auto-merge allowlist.

Customize `repair.yaml`, `promotion.yaml`, required checks, GitHub labels, and
the repository-specific evidence/deployment adapters before enabling writes.
