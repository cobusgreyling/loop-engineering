# Windsurf Examples

Copy-pasteable loop patterns for Windsurf, using Cascade Workflows for scheduling and `.windsurf/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (manual or external cron) | Low | [daily-triage.md](daily-triage.md) |

Windsurf has no native `loop-init --tool windsurf` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example above to wire scheduling into a Cascade Workflow.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```
