# Contributing Opencode Examples — Fork to Merge

*A real experience contributing opencode tool coverage to the loop-engineering reference repository.*

## Context

- Goal: add [opencode](https://opencode.ai) as a first-class tool in the loop-engineering reference
- The repo already had examples for Grok, Claude Code, Codex, and GitHub Actions — opencode had none
- Pattern: tool examples + starter kit + cross-repo documentation updates
- 3 PRs over 2 days: initial coverage → complete parity → openclaw coverage (while waiting)

## Setup

- Branch: `feat/opencode-examples` → PR #98 (initial 3 patterns + starter)
- Branch: `feat/opencode-parity` → PR #104 (remaining 4 patterns + 6 starters)
- Branch: `feat/openclaw-coverage` → PR #105 (openclaw examples — discovered gap while working)
- Dogfood: every commit ran `ci-validate-gates.sh` and `ci-audit-gates.sh` locally before push

## What Worked

- **Pattern-based authoring.** Skimming the existing grok examples told me the exact format for opencode equivalents — the table in `examples/README.md` made coverage gaps visible at a glance.
- **CI gates caught everything.** The registry schema rejected my first attempt because `opencode` wasn't in the enum. The starter audit gate caught a missing state file. No human had to tell me twice.
- **`loop-init` source was easy to patch.** Adding `opencode` to the `TOOL_SUFFIX` and fixing the starter resolution for non-daily-triage patterns was a one-line change that made `npx @cobusgreyling/loop-init . --pattern <any> --tool opencode` work for all 7 patterns.
- **Stories directory.** Knowing the repo values failure reports made it feel safe to write this honest account.

## What Broke

- **First push had invalid bash.** In the daily-triage example I wrote `opencode export <sessionID>`, which bash parses as input redirection. `bash -n` caught it early in CI — fixed before merge.
- **Registry schema was hardcoded.** `patterns/registry.schema.json` and `scripts/validate-registry.mjs` both had a hardcoded set of valid tools. Adding a new tool meant patching 3 files instead of 1. A `registry.yaml`-driven schema would scale better for future tools.
- **Fork PR CI can't comment.** The `audit.yml` workflow posts a loop readiness score comment on PRs — but from a fork, `GITHUB_TOKEN` lacks write permission, so the step fails 403. The audit itself passes; the failure is cosmetic. This also meant no badge on the PR.
- **State file naming inconsistency.** Most patterns use `<pattern>-state.md` but `post-merge-cleanup` maps to `post-merge-state.md`. Easy to miss when scripting starter file checks.

## Metrics

| Metric | Value |
|--------|-------|
| Files changed (total) | 62 (+1633 / -57) |
| Patterns covered (opencode) | 0 → 7 |
| Starters added (opencode) | 1 → 7 |
| Patterns covered (openclaw) | 1 → 7 |
| CI gates caught before merge | 3 (bash syntax, schema enum, missing state file) |
| Registry schema files patched | 3 (schema.json, validate-registry.mjs, registry.yaml) |

## Lesson

The quality of this reference repo is not accidental — it's enforced by automated gates that catch structural errors before they reach human review. Adding a new tool meant: write examples in the established shape, add your tool to 3 validation files, create starters, and run the same CI scripts the maintainer runs.

The most productive pattern was *discover gaps as you go.* We started with "add opencode examples" → found 4 missing patterns → PR #104. While waiting for CI, scanned for other gaps → found OpenClaw at 1/7 → PR #105. Each PR was small, focused, and passed all gates.
