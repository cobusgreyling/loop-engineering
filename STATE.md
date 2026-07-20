# Loop State — loop-engineering reference

Last run: 2026-07-20T06:25:53Z (scheduled maintenance)

## High Priority (loop is acting or waiting on human)

- Maintain loop readiness score ≥ 58 (current: **100**, level **L3**).
- Keep npm packages current after tool changes (tag `loop-audit-v*`, `loop-init-v*`, `loop-cost-v*`, `loop-gate-v*`, `loop-mcp-server-v*` — see docs/RELEASE.md).

## Watch List

- Expand contributor failure stories (dependency sweeper, multi-loop).
- Collect a production story for Post-Merge Cleanup.
- Remaining Cursor doc gaps: [#220](https://github.com/cobusgreyling/loop-engineering/issues/220), [#223](https://github.com/cobusgreyling/loop-engineering/issues/223), [#224](https://github.com/cobusgreyling/loop-engineering/issues/224).
- Other good-first docs/stories: [#196](https://github.com/cobusgreyling/loop-engineering/issues/196), [#195](https://github.com/cobusgreyling/loop-engineering/issues/195), [#173](https://github.com/cobusgreyling/loop-engineering/issues/173), [#147](https://github.com/cobusgreyling/loop-engineering/issues/147), [#120](https://github.com/cobusgreyling/loop-engineering/issues/120), [#119](https://github.com/cobusgreyling/loop-engineering/issues/119), [#118](https://github.com/cobusgreyling/loop-engineering/issues/118), [#117](https://github.com/cobusgreyling/loop-engineering/issues/117).
- Validate `loop-init` scaffolds on fresh projects across all patterns.
- Optional: StackMap outreach [#300](https://github.com/cobusgreyling/loop-engineering/issues/300); adopter research [#262](https://github.com/cobusgreyling/loop-engineering/issues/262); resource suggestion [#246](https://github.com/cobusgreyling/loop-engineering/issues/246).
- `workflow_dispatch` re-runs of release-loop-gate after successful tag publish still fail Publish (version already on npm) — noise only; skip path works on some runs, not all concurrent dispatches.

## Housekeeping (2026-07-20 maintenance)

- Confirmed npm latest: `loop-gate` 1.0.0, `loop-audit` 1.6.1, `loop-mcp-server` 1.1.0, `loop-init` 1.4.0, `loop-context` 1.3.0, `loop-worktree` 1.2.0, `loop-cost` 1.1.0, `loop-sync` 1.0.0, `goal-audit` 1.0.2.
- Tags present: `loop-gate-v1.0.0`, `loop-audit-v1.6.1`, `loop-mcp-server-v1.1.0`.
- Merged overnight: [#314](https://github.com/cobusgreyling/loop-engineering/pull/314) star-history chart; prior release fixes [#313](https://github.com/cobusgreyling/loop-engineering/pull/313), [#312](https://github.com/cobusgreyling/loop-engineering/pull/312), maintenance [#311](https://github.com/cobusgreyling/loop-engineering/pull/311).
- **0 open PRs**; validate-patterns + audit green on main.
- Daily triage last automated run: 2026-07-17 (weekday cron; next scheduled ~08:00 UTC weekdays).
- Pruned stale remotes: `automated/star-history-2026-07-20`, `chore/scheduled-maintenance-2026-07-17`.

## Recent Noise (ignored this run)

- Star-history automation PR #314 (merged).
- StackMap marketing issue #300.
- Failed `workflow_dispatch` release-loop-gate runs after version already published (packages are on npm via tag push).
- Contributor good-first issues backlog (docs/stories) — no blocker.

## Post-Run Critique

- High-noise: concurrent release dispatches after successful tag publish.
- False positives: none this run.
- Deprioritize: StackMap / adopter research vs. doc good-first issues.
- Friction: none (main green, no open PRs).
- Adjustment: prefer tag-push release only; avoid re-dispatching publish for already-released versions.

---
Run log: Updated by `.github/workflows/daily-triage.yml` and scheduled maintenance. See `LOOP.md` for cadence and gates.
