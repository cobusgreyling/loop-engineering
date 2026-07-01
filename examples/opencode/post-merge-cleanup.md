# Post-Merge Cleanup — Opencode

Follow-up tech debt after merges land on main. Low-risk L1 loop — ideal companion after Daily Triage stabilises.

## Prerequisites

```bash
mkdir -p skills/post-merge-scan
cp templates/SKILL.md.loop-triage skills/post-merge-scan/SKILL.md   # adapt to scan merges
cp starters/minimal-loop-opencode/opencode.json.example opencode.json
cp starters/post-merge-cleanup-opencode/post-merge-state.md.example post-merge-state.md
```

## Report-Only (Week 1)

Run off-peak (evening or overnight) to avoid colliding with active work:

```bash
opencode run \
  "Run skills/post-merge-scan/SKILL.md. Read post-merge-state.md first. Scan merges to main in the last 48h. Propose small doc/lint/comment fixes only — ticket anything architectural or multi-file. Update post-merge-state.md. Do not edit source code." \
  --title "Post-merge cleanup"
```

Cadence (cron — run once daily after hours):

```cron
0 2 * * * cd /repo && opencode run "Run post-merge-scan on recent merges. Propose only small fixes. Ticket architecture debt. Update state."
```

## With Small Auto-Fixes (Week 2+)

After 7 report-only runs, enable minimal auto-fixes in a worktree:

```bash
FIX_ID="$(date +%Y%m%d%H%M%S)"
WORKTREE="../wt-cleanup-$FIX_ID"
git worktree add "$WORKTREE" -b "loop/cleanup-$FIX_ID"
opencode run \
  "Run post-merge-scan. For the highest-priority single-file cleanup from the last 48h of merges: implement the fix in this worktree, run tests, and write a diff summary. Escalate to a human for anything on denylist paths." \
  --agent implementer \
  --dir "$WORKTREE"
DIFF_FILE="$(mktemp /tmp/cleanup.XXXXXX.patch)"
git -C "$WORKTREE" diff > "$DIFF_FILE"
opencode run "Review this cleanup diff against project rules and tests. APPROVE or REJECT only." \
  --agent verifier \
  --file "$DIFF_FILE"
```

## Verification Split

| Role | Opencode shape |
|------|----------------|
| Scan | `skills/post-merge-scan/SKILL.md` named in the `opencode run` message |
| Implementer | `opencode run "..." --agent implementer --dir <worktree>` |
| Verifier | `opencode run "Verify diff" --agent verifier --file <diff.patch>` |

## Safety

- Run off-peak (evening) to avoid collision with active branches.
- Never auto-fix architectural debt — file a ticket and move on.
- Denylist paths (`docs/safety.md`) always go to a human.
- Max 2 fix attempts per run; escalate after that.

## References

- [patterns/post-merge-cleanup.md](../../patterns/post-merge-cleanup.md)
- [docs/safety.md](../../docs/safety.md)
- [stories/post-merge-cleanup-honest-win.md](../../stories/post-merge-cleanup-honest-win.md)
