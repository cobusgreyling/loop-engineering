# Post-Merge Cleanup — OpenClaw

Follow-up tech debt after merges land on main. Low-risk L1 loop — pairs naturally with Daily Triage.

## Prerequisites

```bash
mkdir -p skills/post-merge-scan
cp templates/SKILL.md.loop-triage skills/post-merge-scan/SKILL.md
cp starters/minimal-loop/STATE.md.example post-merge-state.md
```

## Report-Only (Week 1)

Run off-peak (evening) to avoid colliding with active work:

```bash
openclaw cron create "0 2 * * *" \
  --name "Post-merge cleanup" \
  --session isolated \
  --message "Run skills/post-merge-scan/SKILL.md. Read post-merge-state.md first. Scan merges to main in the last 48h. Propose small doc/lint/comment fixes only — ticket anything architectural or multi-file. Update post-merge-state.md. Do not edit source code." \
  --tools read
```

## With Small Auto-Fixes (Week 2+)

```bash
openclaw cron edit <job-id> \
  --message "Run post-merge-scan. For the highest-priority single-file cleanup: implement the fix in a worktree, run tests, have a verifier review. Escalate to a human for anything on denylist paths."
```

## Safety

- Run off-peak to avoid collision with active branches.
- Never auto-fix architectural debt — file a ticket.
- Denylist paths always go to a human.
- Max 2 fix attempts per run.

## References

- [patterns/post-merge-cleanup.md](../../patterns/post-merge-cleanup.md)
- [docs/safety.md](../../docs/safety.md)
- [stories/post-merge-cleanup-honest-win.md](../../stories/post-merge-cleanup-honest-win.md)
