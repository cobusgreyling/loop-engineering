# PR Babysitter — OpenClaw

Watch open PRs, surface blockers, and act only on safe obvious maintenance tasks. OpenClaw's channel delivery (Slack, Telegram) makes it ideal for PR notifications.

## Report-Only (Week 1)

```bash
openclaw cron create "*/15 * * * *" \
  --name "PR babysitter" \
  --session isolated \
  --message "Run PR babysitter triage. Read pr-babysitter-state.md first. List PRs with red CI, stale review, merge conflicts, or unanswered review comments. Do not edit code. Update pr-babysitter-state.md and end with the top 3 human actions." \
  --tools read \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

Omit `--announce` to keep output in the Gateway only. Report-only in week one: read GitHub state, update state, notify humans.

## With Small Auto-Fixes (Week 3+)

```bash
openclaw cron edit <job-id> \
  --message "Run PR babysitter triage. For PRs authored by us with red CI caused by a clear single-file regression: create a git worktree, apply a minimal fix, run tests, have a verifier pass review the diff. Draft PR by default — never force-push."
```

## Idempotency

Before pushing, the loop must check whether an open PR or branch already exists for the same intent. Use a webhook or GitHub CLI within the worktree.

## Verification Split

| Role | OpenClaw shape |
|------|----------------|
| Triage | Isolated cron with `--tools read` |
| Implementer | `coding-agent` in worktree via `exec`, or main agent with expanded tools |
| Verifier | Second agent id in `agents.list`, or checker block in cron `--message` |

## Safety

- Never force-push without explicit human opt-in.
- Draft PRs by default; humans mark ready for review.
- Do not resolve review threads without approval.
- Security, auth, payments, infra, or public API changes always escalate.
- Max 3 fix attempts per PR before handoff.

## References

- [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md)
- [docs/safety.md](../../docs/safety.md)
- [examples/github-actions/pr-babysitter.yml](../github-actions/pr-babysitter.yml)
