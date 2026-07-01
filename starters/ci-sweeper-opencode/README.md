# CI Sweeper — Opencode Starter

Clone-and-run scaffold for the **CI Sweeper** pattern with opencode. React to failing CI with minimal fixes at short cadences.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern ci-sweeper --tool opencode
```

Or copy manually:

```bash
cp -r starters/ci-sweeper-opencode/skills .
cp starters/ci-sweeper-opencode/AGENTS.md .
cp starters/ci-sweeper-opencode/LOOP.md .
cp starters/ci-sweeper-opencode/ci-sweeper-state.md.example ci-sweeper-state.md
cp starters/ci-sweeper-opencode/opencode.json.example opencode.json
```

Start (L2 cautious — CI sweeper is action-oriented from week one):

```bash
opencode run \
  "Run skills/ci-triage/SKILL.md. Classify each failing check. For clear single-file regressions, create a worktree and apply a minimal fix with verifier. Update ci-sweeper-state.md. Infra and security failures: escalate." \
  --title "CI sweeper"
```

## What's Included

| File | Purpose |
|------|---------|
| `ci-sweeper-state.md.example` | State spine (in-flight CI failures) |
| `skills/ci-triage/SKILL.md` | CI-focused triage skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/ci-sweeper.md](../../patterns/ci-sweeper.md)
- [examples/opencode/ci-sweeper.md](../../examples/opencode/ci-sweeper.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
