# Post-Merge Cleanup — Opencode Starter

Clone-and-run scaffold for the **Post-Merge Cleanup** pattern with opencode. Follow-up tech debt after merges land on main.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern post-merge-cleanup --tool opencode
```

Or copy manually:

```bash
cp -r starters/post-merge-cleanup-opencode/skills .
cp starters/post-merge-cleanup-opencode/AGENTS.md .
cp starters/post-merge-cleanup-opencode/LOOP.md .
cp starters/post-merge-cleanup-opencode/post-merge-state.md.example post-merge-state.md
cp starters/post-merge-cleanup-opencode/opencode.json.example opencode.json
```

Start (report-only, week 1):

```bash
opencode run \
  "Run skills/post-merge-scan/SKILL.md. Scan merges to main in the last 48h. Propose small doc/lint/comment fixes only — ticket anything architectural. Update post-merge-state.md. Do not edit source code." \
  --title "Post-merge cleanup"
```

## What's Included

| File | Purpose |
|------|---------|
| `post-merge-state.md.example` | State spine template |
| `skills/post-merge-scan/SKILL.md` | Merge-focused scan skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/post-merge-cleanup.md](../../patterns/post-merge-cleanup.md)
- [examples/opencode/post-merge-cleanup.md](../../examples/opencode/post-merge-cleanup.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- [stories/post-merge-cleanup-honest-win.md](../../stories/post-merge-cleanup-honest-win.md)
