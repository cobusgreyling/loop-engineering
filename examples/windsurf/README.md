# Windsurf Examples

Copy-pasteable loop patterns for Windsurf, using Cascade Workflows for scheduling and `.windsurf/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (manual `/daily-triage`) | Low | [daily-triage.md](daily-triage.md) |

No `loop-init --tool windsurf` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example to wire a Cascade Workflow.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```
