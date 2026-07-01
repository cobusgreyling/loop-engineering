# Issue Triage — Opencode Starter

Clone-and-run scaffold for the **Issue Triage** pattern with opencode. Keep the issue queue legible so morning triage always knows the top five.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern issue-triage --tool opencode
```

Or copy manually:

```bash
cp -r starters/issue-triage-opencode/skills .
cp starters/issue-triage-opencode/AGENTS.md .
cp starters/issue-triage-opencode/LOOP.md .
cp starters/issue-triage-opencode/issue-triage-state.md.example issue-triage-state.md
cp starters/issue-triage-opencode/opencode.json.example opencode.json
```

Start (L1 propose-only, week 1):

```bash
opencode run \
  "Run skills/issue-triage/SKILL.md. Scan open issues since last run. Update issue-triage-state.md with top 5, proposed labels, and needs-human bucket. Propose only — do not apply labels or close issues." \
  --title "Issue triage"
```

## What's Included

| File | Purpose |
|------|---------|
| `issue-triage-state.md.example` | State spine (issue queue health) |
| `skills/issue-triage/SKILL.md` | Issue-focused triage skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/issue-triage.md](../../patterns/issue-triage.md)
- [examples/opencode/issue-triage.md](../../examples/opencode/issue-triage.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
