# CI Sweeper — OpenClaw

React to failing CI with minimal fixes and short cadences. OpenClaw's isolated cron sessions at 5–15 minute intervals are a natural fit.

## Prerequisites

```bash
mkdir -p skills/ci-triage skills/minimal-fix skills/loop-verifier
cp templates/SKILL.md.loop-triage skills/ci-triage/SKILL.md
cp templates/SKILL.md.minimal-fix skills/minimal-fix/SKILL.md
cp templates/SKILL.md.verifier skills/loop-verifier/SKILL.md
cp starters/minimal-loop/STATE.md.example ci-sweeper-state.md
```

## Cadence: cron

```bash
openclaw cron create "*/5 * * * *" \
  --name "CI sweeper" \
  --session isolated \
  --message "Run skills/ci-triage/SKILL.md. Classify each failing check. For clear single-file regressions, create a git worktree, implement the fix, run tests, and have a verifier pass review. Update ci-sweeper-state.md. Infra and security failures escalate to a human. Max 3 attempts per item." \
  --tools read,write,exec
```

Use [loop-cost](https://github.com/cobusgreyling/loop-engineering/blob/main/tools/loop-cost) before choosing a cadence.

## Webhook variant (post-deploy)

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'Authorization: Bearer <hooks-token>' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Run ci-triage on recent CI failures. Inspect and classify. No fixes in report-only mode.","name":"CI triage","deliver":false}'
```

## Verification Split

| Role | OpenClaw shape |
|------|----------------|
| Triage | Isolated cron + `ci-triage` skill |
| Implementer | Main agent or `coding-agent` in worktree |
| Verifier | Second agent id or checker block in cron `--message` |

## Safety

- Always dispatch into a git worktree per attempt.
- Infra / security / payments test failures: do not auto-fix; flag and stop.
- Max 3 fix attempts per item; escalate after.
- Restrict `--tools` until the loop is trusted.

## References

- [patterns/ci-sweeper.md](../../patterns/ci-sweeper.md)
- [docs/safety.md](../../docs/safety.md)
- [tools/loop-cost](../../tools/loop-cost)
