# Changelog Drafter — Opencode Starter

Clone-and-run scaffold for the **Changelog Drafter** pattern with opencode. Scan merged PRs and commits, produce categorized release notes.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern changelog-drafter --tool opencode
```

Or copy manually:

```bash
cp -r starters/changelog-drafter-opencode/skills .
cp starters/changelog-drafter-opencode/AGENTS.md .
cp starters/changelog-drafter-opencode/LOOP.md .
cp starters/changelog-drafter-opencode/changelog-drafter-state.md.example changelog-drafter-state.md
cp starters/changelog-drafter-opencode/opencode.json.example opencode.json
```

Start (L1 report + draft, week 1):

```bash
opencode run \
  "Run skills/changelog-scan/SKILL.md. Scan merges since last tag (or last 7 days). Produce categorized draft in RELEASE_NOTES_DRAFT.md. Update state. Do not publish or create PRs." \
  --title "Changelog drafter"
```

## What's Included

| File | Purpose |
|------|---------|
| `changelog-drafter-state.md.example` | State spine (last release, draft status) |
| `skills/changelog-scan/SKILL.md` | Merge scan and categorization skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/changelog-drafter.md](../../patterns/changelog-drafter.md)
- [examples/opencode/changelog-drafter.md](../../examples/opencode/changelog-drafter.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- [stories/changelog-drafter-week-one.md](../../stories/changelog-drafter-week-one.md)
