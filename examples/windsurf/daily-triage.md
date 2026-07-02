# Daily Triage — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a morning triage loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cascade Workflow** (`.windsurf/workflows/daily-triage.md`), invoked manually via `/daily-triage` in Cascade chat.

## Workflow

Create `.windsurf/workflows/daily-triage.md`:

```markdown
# Daily Triage

**Description:** Morning triage — report only, no auto-fix.

1. Run the loop-triage skill on the current project.
2. Append high-priority items to `STATE.md` (High Priority + Watch List only).
3. Do not open PRs or modify source code in week one.
4. Flag anything ambiguous or high-risk for human review in `STATE.md`.
```

Invoke in Cascade with `/daily-triage`. For unattended cadence, use an external trigger (GitHub Actions cron, `launchd`/`cron`) that reminds you to run the workflow — Windsurf workflows are invoke-based, not self-scheduling.

## Progression

- **Week one — report only.** Just append to `STATE.md`. Read it yourself daily before trusting the loop.
- **Add "act on obvious small wins."** Extend the workflow to draft minimal fixes using the `minimal-fix` skill in an isolated worktree.
- **Add connectors.** Wire PR creation / ticket comments via MCP once confident.
- **Add self-cleanup.** Remove the workflow trigger when there is nothing left to watch.

## Requirements

- `STATE.md` in the repo root (committed or shared location)
- The `loop-triage` skill in `.windsurf/rules/loop-triage.md` (copy from `templates/SKILL.md.loop-triage`)
- Manual `/daily-triage` invoke for week one; external scheduler optional for reminders

## Example STATE.md

```markdown
# Loop State — Project X
Last run: 2026-07-02 08:15 UTC

## High Priority (loop is acting or waiting on human)
- [ ] #1241 — flaky test in auth flow (CI red on main)
      Loop action: report only (week one). Needs human triage.
```

See the [primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf) for how Windsurf's workflow model maps to the same six-part loop shape.
