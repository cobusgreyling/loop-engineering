# Changelog

All notable changes to `@cobusgreyling/loop-audit` are documented here.

## [Unreleased]

### Changed
- **Placeholders no longer score.** Empty or whitespace-only files, and `{}` / `[]` JSON, earn nothing and are listed under *Not counted*. A repo of 19 empty files (142 bytes) used to score 100/L3; it now scores 72/L1
- A skill counts only with a `SKILL.md` carrying `name` + `description` frontmatter (bare directories used to count); the same for Claude Code verifier agents
- `gate.yaml` must declare `version: 1` and a `denylist:`; one `loop-gate` would refuse is a failure, not a signal
- `.github/` and workflows count only when they contain a non-empty file
- **L3 requires proven guardrails**: a `loop-drill.json` (from `loop-drill --record`) showing the current `gate.yaml` passing its drills in both directions, with no recorded guardrail failing. Repos that were L3 on files alone drop to L2 until they record

### Added
- `signals.proof`: guardrails that are proven, failed, untested or stale, read from `loop-drill.json`
- A guardrail that `loop-drill` shows failing loses its points: gate → `gateYaml`, verifier → `verifier` (Verifier Theater), breaker → stall detection

## [1.9.0] - 2026-08-28

### Changed
- Loop activity requires a **fresh** `Last run` (≤14 days), a dated `loop-run-log.md` row, or a git commit that actually touches state / run-log files
- `LOOP.md` cadence text and a `triage` commit on README no longer count as activity
- Activity is worth 14 points (was 6)
- Missing `STATE.md` is a warning, not a fail, when `.github/workflows/thin-loop.yml` is present
- Companion funnels are not pushed to the top of `--suggest`

## [1.8.0] - 2026-07-29

### Added
- `--auto-fix` self-heal for missing repository structure (STATE, LOOP, budgets, gate.yaml, etc.)
- Memory-engineering readiness signals and `--with-memory` recommendations

## [1.7.0] - 2026-07-20

### Added
- **Harness Runtime** scoring signals for the LE → harness-foundry funnel:
  - `.foundry/stack.yaml`, `stack.lock`, sessions/traces, outerloop emit path, host integrate hints
- Loop Ready **80+** recommendation / human report CTA → `loop-init --with-foundry`
- `--suggest` copy commands for Foundry scaffold + first `foundry run`

## [1.6.0] - 2026-07-09

### Added
- Governance scoring signals: least-privilege tool scope, stall / no-progress detection, human-escalation path
- `allowed-tools` frontmatter in `SKILL.md` detected as a least-privilege signal
- `--suggest` recommendations when governance signals are missing

## [1.5.3] - 2026-07-06

### Added
- Contributor quickstart CTA after CLI runs (skipped for `--json`, `--md`, and `--badge`)

## [1.5.2] - 2026-06-30

### Added
- Detect verifier agents in `opencode.json` and `opencode.json.example` (maker/checker split for Opencode loops)
- `--suggest` copy commands for Opencode (`loop-init --tool opencode`)

## [1.5.0] - 2026-06-30

### Added
- `loop-constraints.md` and `loop-constraints` skill detection in readiness scoring (+6 points when both present)
- Recommendations when constraints file or skill is missing

## [1.4.1] - 2026-06-13

### Changed
- Updated package description and keywords for better discoverability on npm / npx (emphasizes "loop engineering", coding agents, and concrete usage examples).

## [1.3.0] - 2026-06-09

### Added
- Unit tests for scoring logic (`test/auditor.test.ts`)
- `--suggest` now mentions `loop-init` scaffold CLI
- Registry and starter coverage in audit recommendations

### Changed
- CI gates on test suite before publish

## [1.2.0] - 2026-06-09

### Added
- `--suggest` copy-from-template commands for Grok, Claude Code, and Codex
- Expanded signals: MCP, worktree evidence, `patterns/registry.yaml`
- L3 scoring threshold with verifier + state requirements

## [1.1.0] - 2026-06-08

### Added
- `--md` markdown report format
- Safety doc and GitHub workflow detection

## [1.0.0] - 2026-06-07

### Added
- Initial Loop Readiness Score CLI (L0–L3)
- `--json` output for CI integration