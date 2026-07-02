# Daily Triage — Cursor (Automations / Agent)

This is a practical, copy-pasteable example of a morning triage loop using Cursor.

Cursor has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cloud Automation** (cron) or a recurring **Agent** prompt on cadence.

## Automation prompt (week one — report only)

In Cursor → Automations, create a daily job with a prompt like:

```text
Run the loop-triage skill on the current project.
Append high-priority items to STATE.md (High Priority + Watch List only).
Do not open PRs or modify source code in week one.
Flag anything ambiguous or high-risk for human review in STATE.md.
```

Or invoke manually in Agent chat with the same prompt on your chosen cadence.

## Progression

- **Week one — report only.** Just append to `STATE.md`. Read it yourself daily before trusting the loop.
- **Add "act on obvious small wins."** Extend the automation to draft minimal fixes in an isolated worktree.
- **Add connectors.** Wire PR creation / ticket comments via GitHub MCP (read-only discovery first).
- **Add self-cleanup.** Remove the automation trigger when there is nothing left to watch.

## Requirements

- `STATE.md` in the repo root (committed or shared location)
- The `loop-triage` skill in `.cursor/skills/loop-triage/SKILL.md` (copy from `templates/SKILL.md.loop-triage`)
- Optional always-on triage rules in `.cursor/rules/`
- Cloud Automation for unattended cadence — manual Agent chat works for week one

## Example STATE.md

```markdown
# Loop State — Project X
Last run: 2026-07-02 08:15 UTC

## High Priority (loop is acting or waiting on human)
- [ ] #1241 — flaky test in auth flow (CI red on main)
      Loop action: report only (week one). Needs human triage.
```

See the [primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf) for how Cursor maps to the same six-part loop shape.