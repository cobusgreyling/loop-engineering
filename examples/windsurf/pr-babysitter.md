# PR Babysitter — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a PR babysitter loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cascade Workflow** (`.windsurf/workflows/pr-babysitter.md`), invoked manually via `/pr-babysitter` in Cascade chat. For unattended cadence, pair with a GitHub Action or external scheduler — Windsurf workflows are invoke-based, not self-scheduling.

## Workflow prompt (week one — report only)

Create `.windsurf/workflows/pr-babysitter.md`:

```markdown
# PR Babysitter

**Description:** PR review triage — report only, no auto-merge.

1. Run the pr-review-triage skill on all open PRs.
2. Update pr-babysitter-state.md with current CI status and review state.
3. Do not merge or push fixes in week one — report only.
4. Flag anything ambiguous or high-risk for human review in pr-babysitter-state.md.
5. Use worktree + minimal-fix + loop-verifier only for allowlisted low-risk PRs.
6. Escalate after 3 attempts. No auto-merge in week one.
```

Invoke in Cascade with `/pr-babysitter`. For unattended cadence, use an external trigger (GitHub Actions cron, `launchd`/`cron`) that reminds you to run the workflow — Windsurf workflows are invoke-based, not self-scheduling.

## Progression

- **Week one — report only.** Append to `pr-babysitter-state.md`. Read it yourself
  before acting on any suggestion. Human gates all merges.
- **Add minimal fixes.** Extend the workflow to propose fixes in an isolated
  worktree for allowlisted low-risk PRs only.
- **Add connectors.** Wire PR comments and status updates via MCP
  (read-only discovery first).
- **Add verifier split.** A separate verifier agent approves before any comment
  or fix is posted. Max 3 attempts per PR.

## Requirements

- `pr-babysitter-state.md` in the repo root (from `starters/pr-babysitter/`)
- The `pr-review-triage` skill in `.windsurf/rules/pr-review-triage.md` (copy from `starters/pr-babysitter/`)
- Optional always-on rules in `.windsurf/rules/`
- Manual `/pr-babysitter` invoke for week one; external scheduler (GitHub Action or `cron`) optional for reminders

## Example pr-babysitter-state.md

```markdown
# PR Babysitter State
Last run: 2026-07-05 09:00 UTC

## Open PRs

### #1234 — fix:correct login redirect
- CI: green
- Reviews: 1 approval, 1 blocking comment
- Loop action: report only (week one). Needs human triage.
- Attempts: 1 / 3
```

## Notes

- Combine with `.windsurf/rules/` for always-on constraints across all Cascade sessions
- GitHub Actions can complement the workflow when your machine is off — Windsurf itself has no native cron
- See [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md) and
  [starters/pr-babysitter](../../starters/pr-babysitter/) for the full pattern spec
  and the `pr-babysitter-state.md` template

See the [primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf) for how Windsurf's workflow model maps to the same six-part loop shape.