# Daily Triage — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a morning triage loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cascade Workflow** (`.windsurf/workflows/daily-triage.md`), invoked manually or on a cadence via an external trigger (GitHub Actions cron, or your OS scheduler calling the Windsurf CLI).

## Workflow

Create `.windsurf/workflows/daily-triage.md`:

```yaml
description: Morning triage — report only, no auto-fix
```

```markdown
Run the loop-triage skill on the current project.
Append high-priority items to STATE.md.
Do not open PRs or modify code. Flag anything ambiguous or high-risk for human review in STATE.md.
```

Invoke manually in Cascade with `/daily-triage`, or trigger on a schedule via an external cron (GitHub Actions, `launchd`/`cron`) calling `windsurf --workflow daily-triage` against the repo.

## Progression

- **Week one — report only.** Just append to `STATE.md`. Read it yourself daily before trusting the loop.
- **Add "act on obvious small wins."** Extend the workflow to draft minimal fixes using the `minimal-fix` skill in an isolated worktree.
- **Add connectors.** Once confident, wire up PR creation / ticket comments via MCP.
- **Add self-cleanup.** Have the workflow remove its own trigger when there's nothing left to watch.

This pattern is deliberately boring.

## Requirements

- `STATE.md` in the repo root (committed or shared location)
- The `loop-triage` skill, placed in `.windsurf/rules/loop-triage.md` (copy from `templates/SKILL.md.loop-triage`)
- An external scheduler for true unattended cadence — Windsurf workflows are invoke-based, not self-scheduling

## Example STATE.md

```markdown
# Loop State — Project X
Last run: 2026-07-02 08:15 UTC

## High Priority (loop is acting or waiting on human)
- [ ] #1241 — flaky test in auth flow (CI red on main)
      Loop action: report only (week one). Needs human triage.
```

See the [primitives matrix](../../docs/primitives-matrix.md) for how Windsurf's workflow model maps to the same six-part loop shape used by Grok, Claude Code, and Codex.
