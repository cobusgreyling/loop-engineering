# PR Babysitter — Opencode Starter

Clone-and-run scaffold for the **PR Babysitter** pattern with opencode. Watch open PRs, surface blockers, and act only on safe obvious maintenance tasks.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern pr-babysitter --tool opencode
```

Or copy manually:

```bash
cp -r starters/pr-babysitter-opencode/skills .
cp starters/pr-babysitter-opencode/AGENTS.md .
cp starters/pr-babysitter-opencode/LOOP.md .
cp starters/pr-babysitter-opencode/pr-babysitter-state.md.example pr-babysitter-state.md
cp starters/pr-babysitter-opencode/opencode.json.example opencode.json
```

Start (report-only, week 1):

```bash
opencode run \
  "Run PR babysitter triage. Read pr-babysitter-state.md first. List PRs with red CI, stale review, merge conflicts, or unanswered review comments. Do not edit code. Update pr-babysitter-state.md." \
  --title "PR babysitter"
```

## What's Included

| File | Purpose |
|------|---------|
| `pr-babysitter-state.md.example` | State spine template |
| `skills/pr-review-triage/SKILL.md` | PR-focused triage skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md)
- [examples/opencode/pr-babysitter.md](../../examples/opencode/pr-babysitter.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- [stories/pr-babysitter-week-one.md](../../stories/pr-babysitter-week-one.md)
