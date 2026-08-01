# PR Babysitter — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a PR babysitter loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler or built-in cron. Map the loop to a **Cascade Workflow** (`.windsurf/workflows/pr-babysitter.md`) and invoke it manually with `/pr-babysitter`; if you need unattended cadence, pair it with an external reminder or scheduler such as GitHub Actions cron, `launchd`, `cron`, or systemd that prompts a human to run the workflow.

## Workflow (week one — report only)

Create `.windsurf/workflows/pr-babysitter.md`:

```markdown
# PR Babysitter

**Description:** Check watched pull requests, update state, and report blockers. No auto-merge.

1. Read `pr-babysitter-state.md` and the `pr-review-triage` rule.
2. List open PRs you care about and summarize CI, review, merge conflict, and stale-review status.
3. Update `pr-babysitter-state.md` with current status, last action, and attempts.
4. Do not push fixes, comment on PRs, or merge in week one — report only.
5. Flag ambiguous or high-risk work for human review.
```

Invoke in Cascade with `/pr-babysitter` on your chosen cadence.

For an unattended cadence, keep Windsurf as the reviewer/triage surface and use an external scheduler only to remind a human or open a human-gated prompt. Do not let the scheduler comment, push fixes, approve, label, close, or merge PRs.

## Progression

- **Week one — report only.** Append to `pr-babysitter-state.md`. Read the state yourself before acting on any suggestion.
- **Add minimal fixes.** Allow fixes only for low-risk, allowlisted PRs, and only in an isolated worktree.
- **Add verifier split.** Use a separate checker/verifier before any PR comment or proposed fix is posted.
- **Add connectors.** Wire GitHub MCP or CLI access read-only first; enable comments only after the report-only loop is trusted.

## Requirements

- `pr-babysitter-state.md` in the repo root, copied from `starters/pr-babysitter/pr-babysitter-state.md.example`
- The `pr-review-triage` skill copied into `.windsurf/rules/pr-review-triage.md` from `starters/pr-babysitter/.grok/skills/pr-review-triage/SKILL.md` or another starter variant
- A `.windsurf/workflows/pr-babysitter.md` workflow like the one above
- Manual `/pr-babysitter` invoke for week one; external scheduler or reminder optional after that, with all PR actions still human-gated

## Example pr-babysitter-state.md

```markdown
# PR Babysitter State

Last run: 2026-07-05 09:00 UTC

## Watched PRs

- #1234 (fix-login-redirect)
  Status: CI green | changes requested | not ready
  Attempts: 1/3
  Last action: Reported blocking review comment; no code changes made.
  Human decision: Waiting for maintainer guidance before proposing a fix.

## Escalated (human required)

- #1240 touches auth/session code — keep report-only.
```

## Notes

- Start with PRs you own or explicitly care about; avoid scanning the whole org on every run.
- Keep week-one output short: ready, blocked, stale, or needs human decision.
- Sign any future comments clearly, for example `🤖 Loop Engineering — PR Babysitter`.
- See [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md) and [starters/pr-babysitter](../../starters/pr-babysitter/) for the full pattern spec.

See the [primitives matrix](../../docs/primitives-matrix.md) for how Windsurf maps to the same loop shape.
