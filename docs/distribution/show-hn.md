# Show HN draft

Do not file until the activation PR is on `main` and the last-run badge is live.

## Title

Show HN: 22 weekday agent-triage runs on our own repo – what the score hid

## Text

Loop engineering (the June 2026 slogan: stop prompting, design the loop) has a reference repo: patterns, `npx @cobusgreyling/loop init`, a Loop Ready score.

We ran Daily Triage on that repo every weekday via GitHub Actions. The score stayed 100 / L3. The run log says something smaller:

- 22 recorded weekday runs (log prunes at 30 days)
- 22/22 outcome = report-only
- 0 escalations
- token field = constant 52k, not a measurement
- STATE.md last run 2026-08-27

An ASE workshop paper (arXiv:2608.21884) independently found 217 real loops in the wild and almost no STATE.md files. Most were event-triggered PR review. The tracker already was the state.

So we changed the repo:

1. README is one screen. Default `--tool claude`.
2. Thin loop starter: one GitHub Action, no STATE.md.
3. Loop Ready treats Last run older than 14 days as not-activity.
4. Honest story: https://github.com/cobusgreyling/loop-engineering/blob/main/stories/thirty-weekday-runs.md

Commands:

    npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
    npx @cobusgreyling/loop doctor .

Or the thin version:

    npx @cobusgreyling/loop init . --pattern thin-loop --tool claude

Repo: https://github.com/cobusgreyling/loop-engineering
Paper: https://arxiv.org/abs/2608.21884

We are looking for people who actually run a loop (not just star) to add a row to docs/adopters.md.
