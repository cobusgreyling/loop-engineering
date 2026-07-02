# Daily Triage — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a morning triage loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cascade Workflow**, which is invoked manually within Cascade chat.

## The Workflow File

Save the following markdown content as `.windsurf/workflows/daily-triage.md` in your project root:

```markdown
# Daily Triage

**Description:** Morning triage — report only, no auto-fix.

1. Run the loop-triage skill on the current project.
2. Append high-priority items to `STATE.md` (High Priority + Watch List only).
3. Do not open PRs or modify source code (week one).
4. Flag anything ambiguous or high-risk for human review in `STATE.md`.

Invoke in Cascade with `/daily-triage`.
```

## Running it

Windsurf workflows are invoked manually inside Cascade chat — there's no
documented CLI for unattended scheduling. To run this triage:

1. Open the project in Windsurf.
2. In Cascade chat, type `/daily-triage`.

## Supporting Files You Should Have

- `STATE.md` in the repo root (committed or in a shared location)
- The `loop-triage` skill, placed in `.windsurf/rules/loop-triage.md` (copy from `templates/SKILL.md.loop-triage`)

## Typical STATE.md Shape

```markdown
# Loop State — Project X
Last run: 2026-07-02 08:15 UTC

## High Priority (loop is acting or waiting on human)
- [ ] #1241 — flaky test in auth flow (CI red on main)
      Loop action: report only (week one). Needs human triage.
```

## Evolution Path

- **Week one — report only.** Just append to `STATE.md`. Read it yourself daily before trusting the loop.
- **Add "act on obvious small wins."** Extend the workflow to draft minimal fixes using the `minimal-fix` skill in an isolated worktree.
- **Add connectors.** Once confident, wire up PR creation / ticket comments via MCP.
- **Add self-cleanup.** Have the workflow remove its own trigger when there's nothing left to watch.

This pattern is deliberately boring. Boring loops that run reliably are the ones that actually save time.

See the [primitives matrix](../../docs/primitives-matrix.md) for how Windsurf's workflow model maps to the same six-part loop shape used by Grok, Claude Code, and Codex.
