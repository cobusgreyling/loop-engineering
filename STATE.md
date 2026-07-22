# Loop State — loop-engineering reference

Last run: 2026-07-22T12:52:20Z (scheduled maintenance — post-publish confirm)

## High Priority (loop is acting or waiting on human)

- Maintain loop readiness score ≥ 58 (current: **100**, level **L3**).
- [#332](https://github.com/cobusgreyling/loop-engineering/issues/332) release prep / discussion announce — human when ready to fold `RELEASE_NOTES_DRAFT.md`.

## Watch List

- Contributor failure stories; Post-Merge Cleanup production story
- Remaining Cursor/docs GFI: #220, #223, #224; #118–#120, #147, #173, #195 (#117 via #351, #196 via #350 — done)
- Validate `loop-init --with-foundry` + `goal-init` on fresh projects
- Optional: StackMap #300, Pluribus #262, loop.js #246

## Open PRs

- **None.** Queue cleared after #352 (cache bumps) and close of #348 (superseded notes).

## Housekeeping (2026-07-22)

- **Merged:** #346/#347 cache features, #349 daily-triage CI, #350 Copilot, #351 Continue, #352 version bumps + notes + STATE.
- **Published to npm:**
  - `@cobusgreyling/loop-cost@1.2.0` (tag `loop-cost-v1.2.0`)
  - `@cobusgreyling/loop-context@1.5.0` (tag `loop-context-v1.5.0`)
- **Also current on npm:** loop-audit 1.7.0, loop-init 1.5.0, loop-worktree 1.2.0, loop-gate 1.0.0, goal-init 1.0.0, readiness-core 1.0.0.
- **Closed:** #344 (superseded STATE draft), #348 (stale publish checklist).

## Recent Noise

- Star-history / dependabot automation (routine).
- StackMap #300 marketing.

## Post-Run Critique

- Feature PRs without version bumps blocked consumers until maintenance (#346/#347 gap) — keep bump + RELEASE_NOTES row in the same PR.
- Dist for loop-cost/loop-context was stale on main until #352 rebuild — publish path tests source then ships `dist`; prefer rebuilding tracked dist when tool source changes.

---
Run log: Updated by daily-triage.yml and scheduled maintenance. See LOOP.md for cadence and gates.
