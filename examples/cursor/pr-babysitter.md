# PR Babysitter — Cursor (Automations / Agent)

This is a practical, copy-pasteable example of a PR babysitter loop using Cursor.

Cursor has no native `/loop` scheduler. Map the loop to a **Cloud Automation** (cron)
or trigger manually in Agent chat on cadence.

## Automation prompt (week one — report only)

In Cursor → Automations, create a job with a prompt like:

```text
Run the pr-review-triage skill on all open PRs.
Update pr-babysitter-state.md with current CI status and review state.
Do not merge or push fixes in week one — report only.
Flag anything ambiguous or high-risk for human review in pr-babysitter-state.md.
Use worktree + minimal-fix + loop-verifier only for allowlisted low-risk PRs.
Escalate after 3 attempts. No auto-merge in week one.
```

Or invoke manually in Agent chat with the same prompt on your chosen cadence.

## Progression

- **Week one — report only.** Append to `pr-babysitter-state.md`. Read it yourself
  before acting on any suggestion. Human gates all merges.
- **Add minimal fixes.** Extend the automation to propose fixes in an isolated
  worktree for allowlisted low-risk PRs only.
- **Add connectors.** Wire PR comments and status updates via GitHub MCP
  (read-only discovery first).
- **Add verifier split.** A separate verifier agent approves before any comment
  or fix is posted. Max 3 attempts per PR.

## Requirements

- `pr-babysitter-state.md` in the repo root (from `starters/pr-babysitter/`)
- The `pr-review-triage` skill in `.cursor/skills/pr-review-triage/SKILL.md`
- Optional always-on rules in `.cursor/rules/`
- Cloud Automation for unattended cadence — manual Agent chat works for week one

## Example pr-babysitter-state.md

```markdown
# PR Babysitter State
Last run: 2026-07-05 09:00 UTC

## Open PRs

### #1234 — fix: correct login redirect
- CI: green
- Reviews: 1 approval, 1 blocking comment
- Loop action: report only (week one). Needs human triage.
- Attempts: 1 / 3
```

## Notes

- Combine with `.cursor/rules/` for always-on constraints across all Agent sessions
- GitHub Actions can complement the Automation when your machine is off
- See [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md) and
  [starters/pr-babysitter](../../starters/pr-babysitter/) for the full pattern spec

See the [primitives matrix](../../docs/primitives-matrix.md) for how Cursor maps
to the same six-part loop shape.