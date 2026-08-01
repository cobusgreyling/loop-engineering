# Windsurf Examples

Copy-pasteable loop patterns for Windsurf, using Cascade Workflows as the manual workflow surface and `.windsurf/rules/` for persistent skill context. External reminders or triggers can provide cadence, but should not merge or act on PRs.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (manual `/daily-triage`) | Low | [daily-triage.md](daily-triage.md) |
| PR Babysitter | 5m–15m (manual `/pr-babysitter`; external reminder optional) | Medium | [pr-babysitter.md](pr-babysitter.md) |

No `loop-init --tool windsurf` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example to wire a Cascade Workflow.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```
