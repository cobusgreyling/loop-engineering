# Generic Agent Harness abstraction for --tool flag

**Status:** ready-for-agent
**Created:** 2026-11-12
**ADR:** `docs/adr/0001-generic-agent-harness.md`
**Glossary:** `GLOSSARY.md`

## Problem Statement

The `--tool` flag in `loop-init` accepts a closed enum of four values (`claude`, `grok`, `codex`, `opencode`). Each tool requires its own starter variant directory because file layout conventions differ across agent products. This creates an N×M maintenance burden: every new pattern requires T tool-specific copies, and every new harness requires P pattern-specific copies. New public harnesses (DeepSeek Harness, Cursor, Amp, Hermes) are emerging faster than the repo can absorb them. The current model does not scale past ~4 tools.

## Solution

Introduce a **Harness Manifest** abstraction that separates *where artifacts go* (layout) and *what the agent can do* (capabilities) from *what gets written* (pattern content). The `--tool` flag resolves to a manifest key rather than a hardcoded enum. Starter content becomes tool-agnostic; scaffold routing reads the manifest to place files correctly. Adding a new harness drops from O(P) starter copies to one manifest file.

See ADR: `docs/adr/0001-generic-agent-harness.md` for full decision record.
See Glossary: `GLOSSARY.md` for canonical term definitions (Harness, Tool, Foundry, Pattern, Capability).

## User Stories

1. As a loop-engineering maintainer, I want to add support for a new agent harness by writing a single YAML manifest file, so that I avoid creating P new starter variant directories.
2. As a pattern author, I want to write one set of tool-agnostic starter content, so that my pattern automatically works with every current and future harness.
3. As a user running `loop-init --tool deepseek-harness`, I want the CLI to resolve my harness from a manifest and scaffold correctly, so that I get a working loop setup without upstream code changes.
4. As a user running `loop-init --tool claude`, I want the command to continue working exactly as before, so that existing workflows are not broken.
5. As a user running `loop-init --tool <unknown>`, I want a clear error message naming the missing harness, so that I can diagnose typos or missing manifests immediately.
6. As a user running a pattern that requires worktrees against a harness that lacks worktree support, I want scaffold to fail fast with a specific capability-missing error, so that I do not get a broken loop that fails at runtime.
7. As a test suite, I want the scaffold validation matrix to be generated dynamically from harness and pattern manifests, so that adding a new harness automatically produces positive and negative test cases without test code changes.
8. As a CI system, I want scaffold tests to have a consistent naming prefix, so that test reporting dashboards can aggregate results across dynamic matrix entries.
9. As a developer migrating from legacy starters, I want a deprecation notice when using old `starters/*-<tool>` directories, so that I know to update before the next breaking release.
10. As a future contributor designing an external harness registry, I want the manifest schema to include a version field and extension points, so that schema evolution does not require breaking changes.
11. As a documentation reader, I want GLOSSARY.md to define Harness, Tool, Foundry, Pattern, and Capability unambiguously, so that all specs and ADRs use consistent terminology.
12. As a harness vendor, I want to submit a single manifest PR to loop-engineering, so that my product is supported without modifying scaffold logic or test code.

## Implementation Decisions

1. **Harness manifest schema** lives at `harnesses/<id>.yaml` with fields: `id`, `display_name`, `version`, `layout` (skills_dir, skill_filename, agents_dir, config_file), `capabilities` (shell, file_write, skill_read, worktree, sub_agent, scheduling, mcp), and `aliases`. Schema version starts at `"1.0"` with `custom` extension point under `layout` for non-standard conventions.

2. **Minimum viable contract** requires three capabilities: `skill_read`, `file_write`, `shell`. All others are optional. Patterns declare `required_capabilities` in their own manifest; scaffold verifies subset inclusion before writing any files.

3. **Starters directory restructure** moves from `starters/<pattern>-<tool>/` (N×M) to `starters/<pattern>/content/` + `starters/<pattern>/manifest.yaml` (N+M). Content directory holds tool-agnostic skill bodies, verifier prompts, and budget templates. Legacy directories retained one release cycle with deprecation notices.

4. **Scaffold routing** in `loop-init/src/cli.ts` changes from tool-enum switch to: load harness manifest → load pattern manifest → capability check → map content files per layout. The seam is the existing tool-branching logic in cli.ts; it is replaced, not added alongside.

5. **Backward compatibility** via `aliases` field in each built-in harness manifest. `--tool claude` resolves to `harnesses/claude.yaml` transparently. No output changes for existing tool × pattern combinations during deprecation period.

6. **Validation matrix** in `tools/loop-init/test/cli.test.mjs` generates test cases dynamically from `harnesses/*.yaml` × `starters/*/manifest.yaml`. Capability-satisfied pairs assert file presence; unsatisfied pairs assert fail-fast error messages. Test names prefixed with `[scaffold]` for CI aggregation.

7. **Fail-fast behavior** produces structured error messages naming the missing capability and the pattern that requires it. No partial scaffolds are ever written when capabilities are insufficient.

8. **Foundry orthogonality**: `--with-foundry` behavior is unchanged. Foundry scaffolding happens after harness-based scaffold completes, as a separate pass. No interaction between manifest routing and foundry logic.

## Testing Decisions

1. **Good tests verify external behavior**: scaffold output file structure matches harness layout declarations; fail-fast errors contain actionable messages; backward-compatible aliases resolve correctly. Tests do not assert internal routing logic or manifest parsing implementation.

2. **Modules tested**: harness manifest loader, pattern manifest loader, capability checker, file mapper, and the integrated scaffold pipeline. Each has unit-level tests; the integration test covers end-to-end scaffold into a temp directory.

3. **Prior art**: existing `tools/loop-init/test/cli.test.mjs` already runs scaffold-into-temp-dir assertions per pattern × tool combination. The new dynamic matrix extends this pattern rather than replacing it. Negative test cases (capability mismatch → reject) are new but follow the same temp-dir + assertion shape.

4. **Deprecation tests**: verify that legacy starter directories emit warnings and still produce correct output during the deprecation period. These tests are removed when legacy directories are deleted.

## Out of Scope

- External harness registry (npm packages, git repos, or HTTP endpoints)
- User-local harness overrides (`.loop/harness.yaml`)
- Automatic capability detection from layout inspection
- Changes to harness-foundry runtime stack or `--with-foundry` behavior
- Modifications to starter content (skill bodies, verifier prompts, budget templates)
- Migration of existing starter content to new directory structure (deferred to follow-up task after manifest infrastructure lands)
- Support for non-file-based harness conventions (e.g., API-only agents)

## Further Notes

- The manifest schema is intentionally minimal. If a harness has conventions that do not fit the standard `layout` fields, use the `custom` extension point rather than expanding the top-level schema. Schema evolution should be driven by real harness needs, not speculative design.
- The deprecation period for legacy starters should be at least one minor release. Announce in release notes.
- Dynamic test matrix size grows linearly with harness count. At current scale (~4 built-in harnesses × ~6 patterns = ~24 tests), this is well within CI budget. Monitor if harness count exceeds ~20.
- This spec implements the design approved in the grilling session and recorded in ADR 0001.
