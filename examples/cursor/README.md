# Cursor Examples

Copy-pasteable loop patterns for Cursor, using **Automations** (cloud cron) or manual Agent chat for scheduling and `.cursor/skills/` + `.cursor/rules/` for persistent skill context.

| Example | Cadence | Risk | File |
|---|---|---|---|
| Daily Triage | 1d–2h (Automation or manual) | Low | [daily-triage.md](daily-triage.md) |
| Constraints | Every loop run (before triage) | Low | [constraints.md](constraints.md) |
| PR Babysitter | On cadence (Automation or manual) | Medium | [pr-babysitter.md](pr-babysitter.md) |
| CI Sweeper | 15m or failing-check trigger; report-only first | Medium | [ci-sweeper.md](ci-sweeper.md) |
| Dependency Sweeper | 6h report, patch-only after tuning | Medium | [dependency-sweeper.md](dependency-sweeper.md) |
| Changelog Drafter | Daily or release event; draft-only | Low | [changelog-drafter.md](changelog-drafter.md) |
| Issue Triage | 2h–1d; propose labels only in week one | Low | [issue-triage.md](issue-triage.md) |
| Post-Merge Cleanup | 1d (Automation or manual) | Low | [post-merge-cleanup.md](post-merge-cleanup.md) |

No `loop-init --tool cursor` yet — copy `SKILL.md` + `STATE.md` from any starter (e.g. `starters/minimal-loop`), then follow the example to wire scheduling.

Audit after copying:
```bash
npx @cobusgreyling/loop-audit . --suggest
```
