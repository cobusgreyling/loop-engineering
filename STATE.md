# Loop State — loop-engineering reference

Last run: 2026-07-22T10:02:11Z (scheduled maintenance / Grok loop)

## High Priority (loop is acting or waiting on human)

- Maintain loop readiness score ≥ 58 (current: **100**, level **L3**).
- **npm packages published:** readiness-core 1.0.0 · goal-init 1.0.0 · loop-context **1.4.0** · loop-cost **1.1.0** · loop-audit 1.7.0 · loop-init 1.5.0.
- **Publish gap (human):** #346 / #347 merged **feature code without version bumps**. npm still serves pre-feature `loop-cost@1.1.0` / `loop-context@1.4.0`. Recommend bump + tag release (e.g. loop-cost **1.2.0**, loop-context **1.5.0**) via release workflows.
- **Open PRs:**
  - [#350](https://github.com/cobusgreyling/loop-engineering/pull/350) Copilot primitives appendix (@adity982) — **draft**, GFI [#196](https://github.com/cobusgreyling/loop-engineering/issues/196); workflows need approval.
  - [#348](https://github.com/cobusgreyling/loop-engineering/pull/348) release notes draft (@nivinlabs) — mergeable/BLOCKED; scope vs [#332](https://github.com/cobusgreyling/loop-engineering/issues/332).
  - [#344](https://github.com/cobusgreyling/loop-engineering/pull/344) this curated STATE draft (rebased onto main post-#346/#347/#349).
- [#332](https://github.com/cobusgreyling/loop-engineering/issues/332) release prep — week of 2026-07-20.

## Watch List

- Re-run **Daily Triage** dogfood after #349 (next scheduled weekday run, or manual workflow_dispatch).
- Contributor failure stories; Post-Merge Cleanup production story
- Cursor/docs GFI: #220, #223, #224; #117–#120, #147, #173, #195; #196 via #350
- Validate `loop-init --with-foundry` + `goal-init`; Foundry dogfood
- Optional: StackMap #300, Pluribus #262, loop.js #246

## Housekeeping (2026-07-22 ~10:00 UTC)

- **Merged:** [#346](https://github.com/cobusgreyling/loop-engineering/pull/346) loop-cost prompt-caching, [#347](https://github.com/cobusgreyling/loop-engineering/pull/347) loop-context caching budget, [#349](https://github.com/cobusgreyling/loop-engineering/pull/349) daily-triage readiness-core build.
- Main HEAD: `8a776a0`. Main CI green on merge commits.
- Audit gates 100. No version/tag publish this cycle (L1 escalate only).
- Remote branch `fix/daily-triage-readiness-core-build` pruned after merge.

## Recent Noise

- StackMap #300.
- Dependabot moderate alert if still open.

## Post-Run Critique

- Feature PRs that change published CLIs should include package.json bumps + RELEASE.md rows in the same PR (same lesson as goal-init release gap).
- #348 vs #332 still needs human coordination.

---
Run log: Updated by daily-triage.yml and scheduled maintenance. See LOOP.md.
