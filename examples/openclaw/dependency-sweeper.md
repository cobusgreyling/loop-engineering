# Dependency Sweeper — OpenClaw

Discover, safely apply, and verify dependency updates. OpenClaw's worktree isolation via `exec` + `git worktree` keeps each attempt safe.

## Prerequisites

```bash
mkdir -p skills/dependency-triage skills/loop-verifier skills/minimal-fix
cp templates/SKILL.md.loop-triage skills/dependency-triage/SKILL.md
cp templates/SKILL.md.verifier skills/loop-verifier/SKILL.md
cp templates/SKILL.md.minimal-fix skills/minimal-fix/SKILL.md
cp starters/minimal-loop/STATE.md.example dependency-sweeper-state.md
```

## L1 — Report Mode (Week 1)

```bash
openclaw cron create "0 */6 * * *" \
  --name "Dependency sweeper" \
  --session isolated \
  --message "Run skills/dependency-triage/SKILL.md. Scan package manifests and lockfiles for outdated and vulnerable deps. Report findings only — do not edit any files. Update dependency-sweeper-state.md with the top-priority items. Escalate majors and high-sev CVEs." \
  --tools read
```

## L2 — Patch-Only Auto-Fix (Week 3+)

```bash
openclaw cron edit <job-id> \
  --message "Run dependency-triage. For the highest-severity patch-only upgrade: apply the fix in a worktree, run npm ci && npm test, have a verifier review the diff. Never touch denylisted packages. Escalate majors to a human."
```

## Verification Split

| Role | OpenClaw shape |
|------|----------------|
| Triage | Isolated cron with `--tools read` |
| Implementer | Main agent or `coding-agent` in worktree |
| Verifier | Second agent id or checker block in cron `--message` |

## Safety

- **Patch-only by default.** Majors and breaking changes escalate to human.
- Maintain a denylist in `dependency-sweeper-state.md`.
- Max 3 fix attempts per run; pause after 5 auto-PRs per day.

## References

- [patterns/dependency-sweeper.md](../../patterns/dependency-sweeper.md)
- [docs/safety.md](../../docs/safety.md)
- [stories/dependency-sweeper-week-one.md](../../stories/dependency-sweeper-week-one.md)
