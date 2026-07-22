# Loop State — loop-engineering reference

Last run: 2026-07-22T12:48:31Z (scheduled maintenance — publish checklist + cache bumps + STATE)

## High Priority (loop is acting or waiting on human)

- Maintain loop readiness score ≥ 58 (current: **100**, level **L3**).
- **Publish after this PR merges:** tag `loop-cost-v1.2.0` and `loop-context-v1.5.0` (prompt-caching work from #346/#347). See `RELEASE_NOTES_DRAFT.md` checklist.
- [#332](https://github.com/cobusgreyling/loop-engineering/issues/332) release prep / discussion announce — human when notes are ready.

## Watch List

- Contributor failure stories; Post-Merge Cleanup production story
- Remaining Cursor/docs GFI: #220, #223, #224; #118–#120, #147, #173, #195 ( #117 via #351, #196 via #350 — done)
- Validate `loop-init --with-foundry` + `goal-init` on fresh projects
- Optional: StackMap #300, Pluribus #262, loop.js #246

## Open PRs

- None expected after merge of this maintenance PR and close of #348 (superseded).
- If anything reopens: first-time contributor workflows need `validate`+`audit` approval before merge.

## Housekeeping (2026-07-22)

- **Merged:** #346 loop-cost caching, #347 loop-context caching budget, #349 daily-triage readiness-core build, #350 Copilot appendix, #351 Continue appendix.
- **Closed:** #344 night STATE draft (superseded); #348 release-notes draft (stale npm table — replaced by this checklist).
- **Version bumps in this run:** loop-cost **1.2.0**, loop-context **1.5.0** (npm still 1.1.0 / 1.4.0 until tags).
- Other packages already current on npm: loop-audit 1.7.0, loop-init 1.5.0, loop-worktree 1.2.0, loop-gate 1.0.0, goal-init 1.0.0, readiness-core 1.0.0.

## Recent Noise

- Star-history / dependabot automation (routine).
- StackMap #300 marketing.

## Post-Run Critique

- Friction: #346/#347 shipped features without package.json bumps — blocked real npm consumers until this maintenance.
- Adjustment (reaffirmed): any `tools/*` behavior change PR must include version bump + RELEASE_NOTES_DRAFT row in the same PR.
- Friction: first-time contributor PRs blocked on workflow approval for required checks — approve early in triage.

---
Run log: Updated by daily-triage.yml and scheduled maintenance. See LOOP.md for cadence and gates.
