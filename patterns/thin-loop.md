# Thin Loop

**Goal:** Run a report-only loop from GitHub Actions with almost no extra files. The issue tracker and the Actions job summary *are* the state.

This pattern exists because most loops in the wild already look like this. [Lulla et al. (2026)](https://arxiv.org/abs/2608.21884) confirmed 217 autonomous agent loops across 36k repositories: they commit **triggers** (cron / `pull_request` workflows), and almost never commit `STATE.md`. A thin loop matches that shape on purpose.

## When to use it

- You want a loop this week, not a methodology install.
- PR review or issue snapshot is the job; there is nothing to persist that GitHub does not already store.
- You will add `STATE.md` later **if** findings need to survive across runs (backlogs, attempt counts, budgets).

Do **not** start here if you need attempt caps, a maker/checker split, or a token kill switch — use [Daily Triage](./daily-triage.md) or [PR Babysitter](./pr-babysitter.md).

## Scheduling

| Surface | Trigger |
|---------|---------|
| GitHub Actions | `issues` / `pull_request` opened + weekday cron (see starter) |
| Claude / Grok / Codex | Optional later: `/loop 1d` reading the last job summary |

Week one: **L1**. The workflow writes `$GITHUB_STEP_SUMMARY`. It comments on the triggering issue/PR only when that thread does not already have a thin-loop marker.

## Required skills / state

None required. Optional: copy `loop-triage` if you later wire an agent into the `command` step via [loop-action](../tools/loop-action/).

State file: **not required**. GitHub issues/PRs carry the backlog. A `loop-run-log.md` line is optional proof for Loop Ready activity scoring.

## Typical cycle

1. Event or weekday cron fires.
2. Workflow lists open PRs and issues (`gh`).
3. Snapshot goes to the job summary.
4. If the event is an issue or PR, a short L1 comment is posted once.
5. Human reads the summary or comment. No code edits, no auto-merge.

## Verification

There is no implementer, so there is no verifier. The check is mechanical: `gh` succeeded and the summary is non-empty. If you later invoke an agent, add [loop-verifier](../templates/SKILL.md.verifier) before any write.

## Human hand-off

Everything is a hand-off. The loop does not close issues, apply labels, or push commits.

## Tool notes

- **GitHub Actions** is the native runtime. Starter: [starters/thin-loop](../starters/thin-loop/).
- Other tools: scaffold with `npx @cobusgreyling/loop init . --pattern thin-loop --tool claude` (tool suffix is ignored; you still get the workflow).

## Failure modes

| Failure | What to do |
|---------|------------|
| Comment spam | Marker `<!-- thin-loop -->` skips a second comment |
| Empty snapshot | `gh` auth — workflow needs `issues: write` / `pull-requests: write` |
| People expect a high Loop Ready score | Thin loops stay low until a dated run log or `STATE.md` Last run exists. That is intended. |

## Success metrics

- First green workflow run within 10 minutes of merge.
- No comments on threads that already had the marker.
- Zero file edits on `main` from the loop itself.
