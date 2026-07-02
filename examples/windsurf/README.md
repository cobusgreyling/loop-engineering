# Windsurf Examples

Copy-pasteable loop patterns for Windsurf, using Cascade Workflows for scheduling and `.windsurf/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | Manual | Low | [daily-triage.md](daily-triage.md) |

Windsurf has no native `loop-init --tool windsurf` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example above to create a Cascade Workflow. Note: save the workflow file as `.windsurf/workflows/daily-triage.md` in your own project root.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```
