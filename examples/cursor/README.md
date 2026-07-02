# Cursor Examples

Copy-pasteable loop patterns for Cursor, using **Automations** (cloud cron) or manual Agent chat for scheduling and `.cursor/skills/` + `.cursor/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (Automation or manual) | Low | [daily-triage.md](daily-triage.md) |

No `loop-init --tool cursor` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example to wire scheduling.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```