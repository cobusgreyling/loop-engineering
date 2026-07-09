# Changelog

All notable changes to `@cobusgreyling/loop-audit` are documented here.

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