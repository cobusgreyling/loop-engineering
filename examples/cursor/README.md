# Cursor Examples

Copy-pasteable loop patterns for Cursor, using **Automations** (cloud cron) or manual Agent chat for scheduling and `.cursor/skills/` + `.cursor/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (Automation or manual) | Low | [daily-triage.md](daily-triage.md) |
| Constraints | Every loop run (before triage) | Low | [constraints.md](constraints.md) |
| PR Babysitter | On cadence (Automation or manual) | Medium | [pr-babysitter.md](pr-babysitter.md) |
| Dependency Sweeper | 6h report, patch-only after tuning | Medium | [dependency-sweeper.md](dependency-sweeper.md) |

No `loop-init --tool cursor` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example to wire scheduling.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```