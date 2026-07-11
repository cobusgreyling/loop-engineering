# Multi-Loop Priority Collision — Dependency Sweeper vs CI Sweeper

## Setup

- **CI Sweeper**: `/loop 15m` (active hours) on red main
- **Dependency Sweeper**: `/loop 6h`
- **Shared Environment**: `main` branch and active CI runs

## What Worked

- CI Sweeper correctly picked up a test regression on `main` caused by an API contract change.
- Dependency Sweeper correctly identified out-of-date patch dependencies.

## What Broke

- **Branch and CI Collision**: While CI Sweeper was running fix attempts on `main`, Dependency Sweeper kicked off its scheduled run and merged a "safe" minor dependency update directly to `main` without checking if `main` was already red.
- **Budget Exhaustion**: This dependency update introduced a transitive regression, which broke additional tests. CI Sweeper, unaware of the dependency shift, continued trying to fix the original bug in a newly-broken environment, burning through the remaining daily token budget (~1.5M tokens) in under an hour.
- **State File Conflict**: Both loops attempted to write to `loop-run-log.md` at the same time, leading to git push failures and lock retries that delayed human intervention.

## Metrics

| Metric | Value |
|--------|-------|
| Wasted tokens | ~1.5M |
| Conflicting commits | 4 |
| Human hours to debug | 3 hours |
| Root cause | Dependency Sweeper ignored red CI status |

## Lesson

Never run low-priority mutation loops when high-priority fixes are active. We adjusted [multi-loop.md](../docs/multi-loop.md) to define a strict priority stack. Dependency Sweeper now runs a pre-flight check: it reads `ci-sweeper-state.md` and checks if `main` CI is green; if not, it skips execution and schedules a retry in 2 hours. We also added staggered cron execution schedules to prevent state file write collisions.
