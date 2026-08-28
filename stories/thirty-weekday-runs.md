# Thirty weekday runs — what Loop Ready 100 hid

**Pattern:** Daily Triage (this repository)  
**Window:** 2026-07-29 → 2026-08-27 (the run log prunes at 30 days)  
**Level:** L1 report-only, GitHub Actions

## Setup

`.github/workflows/daily-triage.yml` runs weekdays, writes `STATE.md` from open PRs and issues (`scripts/github-triage.mjs`), appends `loop-run-log.md`, and opens an automated PR. Humans merge. No auto-fix.

Loop Ready on this repo stayed **100 (L3)** for the whole window.

## What the log actually shows

| Metric | Value |
|--------|-------|
| Recorded runs | **22** (weekdays; log does not keep a full 60 days) |
| Outcome | **22 / 22 `report-only`** |
| Escalations | **0** |
| `items_found` sum | **28** (almost always 1 per morning) |
| `tokens_estimate` sum | **1,144,000** |

The token column is a **constant 52,000** written by the workflow, not a meter. Treat it as an upper bound we never measured. That is a loop-engineering own-goal: we tell everyone to log spend, then log a placeholder.

## What worked

- The heartbeat did not die. Automated PRs for `STATE.md` kept landing.
- Report-only held. Zero fix attempts, zero merges from the agent.
- The file that mattered to humans was the High Priority / Watch list, not the score.

## What broke (or never started)

- **Score ≠ work.** L3 on a loop that never leaves L1 is verifier theater for the badge.
- **Estimates are not observations.** `tokens_estimate: 52000` every row taught us nothing about cost.
- **Stale GFIs sat in Watch for 50+ days.** The loop reported them; nobody closed or rewrote them. A report-only loop still needs a human who reads.
- **We asked for 60 days of numbers and only kept 30.** The log’s own prune rule deleted the evidence a Show HN needs.

## Lesson

A loop that only writes `STATE.md` is still a cron job with a better filename — and that can be the right design. The failure is advertising L3 / 100 while the run log says `report-only` and the token field is hardcoded.

Changes that follow from this story: last-run badge on the README, Loop Ready weights **fresh runs** over files, and a [thin loop](../patterns/thin-loop.md) for teams who should not pretend they have state files.

## Metrics (copy for Show HN)

```
22 weekday Daily Triage runs
22 report-only, 0 escalations
Loop Ready 100 the whole time
token field: constant 52k, not measured
STATE.md last run: 2026-08-27
```
