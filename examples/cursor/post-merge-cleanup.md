# Post-Merge Cleanup — Cursor (Automations / Agent)

This is a practical, copy-pasteable example of a post-merge cleanup loop using Cursor.

Cursor has no native `/loop` scheduler. Map the loop to a **Cloud Automation** (cron) or trigger manually in Agent chat on cadence.

## Automation prompt (week one — report only)

In Cursor → Automations, create a job with a prompt like:

```text
Run the post-merge-scan skill on recent merges to main in the last 48h.
Update post-merge-state.md.
Do not modify source code or open PRs in week one — report only.
Flag anything ambiguous or high-risk for human review in post-merge-state.md.
```

Or invoke manually in Agent chat with the same prompt on your chosen cadence.

## Progression

- **Week one — report only.** Just update `post-merge-state.md`. Review it manually before making changes.
- **Add docs-only/low-risk fixes.** Extend the automation to draft minimal fixes (documentation updates, comment fixes, or simple lint corrections) in an isolated worktree for allowlisted low-risk files.
- **Add verifier approval.** Use a separate verifier agent/step to ensure docs-only/low-risk fixes are correct before committing/pushing.
- **Add ticket integration.** Wire ticket/issue creation via GitHub/Linear MCP for larger architectural tasks that shouldn't be auto-fixed.

## Requirements

- `post-merge-state.md` in the repo root (copy from [post-merge-state.md.example](../../starters/post-merge-cleanup/post-merge-state.md.example))
- The `post-merge-scan` skill in `.cursor/skills/post-merge-scan/SKILL.md` (copy from `starters/post-merge-cleanup/.claude/skills/post-merge-scan/SKILL.md` or similar)
- A `verifier` skill in `.cursor/skills/verifier/SKILL.md` (copy from `templates/SKILL.md.verifier`) for L2 docs-only fixes
- Cloud Automation for unattended cadence — manual Agent chat works for week one

## Example post-merge-state.md

```markdown
# Post-Merge Cleanup State — Project X
Last run: 2026-07-06 23:00 UTC
Status: report-only (week 1)

## Pending Cleanup (from recent merges)
- [ ] PR #456 merged — update API docs for new user fields
      Source: commit def4567, line 82 in docs/api.md
      Risk: low | Effort: small
- [ ] PR #452 merged — clean up deprecated config warning message
      Source: commit abc1234, line 12 in config/settings.ts
      Risk: low | Effort: small

## Completed (last 14d)
- (none)

## Deferred (human decision)
- PR #448 merged — database schema refactor deferred; ticket ENG-1005 created

## Denylist paths
- auth/
- payments/
- infra/
```

## Notes

- Run off-peak (overnight / off-hours) to avoid colliding with active development branch builds.
- Combine with `.cursor/rules/` for always-on constraints across all Agent sessions.
- See [patterns/post-merge-cleanup.md](../../patterns/post-merge-cleanup.md) and [starters/post-merge-cleanup/](../../starters/post-merge-cleanup/) for the full pattern spec.

See the [primitives matrix](../../docs/primitives-matrix.md) for how Cursor maps to the same six-part loop shape.
