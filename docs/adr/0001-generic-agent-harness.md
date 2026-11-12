# ADR 0001: Generic Agent Harness Abstraction for `--tool`

## Status

Accepted

## Context

The `--tool` flag in `loop-init` currently accepts a closed enum of four values (`claude`, `grok`, `codex`, `opencode`). Each tool has its own starter variant directory under `starters/` because file layout conventions differ across agent products (`.claude/skills/` vs `.grok/` vs `AGENTS.md`, etc.). This creates an N×M maintenance burden: every new pattern requires T tool-specific copies, and every new harness requires P pattern-specific copies. New public harnesses (DeepSeek Harness, Cursor, Amp, Hermes) are emerging faster than the repo can absorb them.

A parallel `--with-foundry` flag already scaffolds a separate `harness-foundry` runtime stack, but this is orthogonal to the per-tool starter problem and does not solve it.

## Decision

Introduce a **Harness Manifest** abstraction that separates *where artifacts go* (layout) and *what the agent can do* (capabilities) from *what gets written* (pattern content). The `--tool` flag resolves to a manifest key rather than a hardcoded enum. Starter content becomes tool-agnostic; scaffold routing reads the manifest to place files correctly.

### Harness Manifest Schema

Each harness is described by `harnesses/<id>.yaml`:

```yaml
id: string                    # manifest key, matches filename
display_name: string          # human-readable name
version: "1.0"                # schema version for future evolution
layout:
  skills_dir: string          # where skill files are placed
  skill_filename: string      # naming convention for individual skills
  agents_dir: string          # where agent/verifier prompts are placed
  config_file: string | null  # harness main config file (null if none)
capabilities:
  shell: boolean              # can execute shell commands
  file_write: boolean         # can write files
  skill_read: boolean         # can read markdown skills
  worktree: boolean           # optional: native worktree support
  sub_agent: boolean          # optional: native sub-agent spawning
  scheduling: "none" | "native" | "external"
  mcp: boolean                # optional: MCP connector support
aliases: string[]             # backward-compatible --tool values
```

### Minimum Viable Contract

A harness must support three primitives to be eligible for any loop pattern: `skill_read`, `file_write`, and `shell`. All other capabilities are optional enhancements that patterns may require individually.

### Starters Directory Restructure

From N×M (`starters/<pattern>-<tool>/`) to N+M:

- `starters/<pattern>/content/` — tool-agnostic skill bodies, verifier prompts, budget templates
- `starters/<pattern>/manifest.yaml` — pattern metadata including `required_capabilities`
- `harnesses/<id>.yaml` — harness layout and capability declarations

Scaffold routing: load harness manifest → load pattern manifest → verify `required_capabilities ⊆ harness.capabilities` → fail-fast with clear error if unsatisfied → map `content/` files to target paths per `harness.layout`.

### Backward Compatibility

- Legacy `--tool` values (`claude`, `grok`, `codex`, `opencode`) resolve through built-in aliases in their respective manifests.
- Existing `starters/*-<tool>` directories are retained for one release cycle, marked deprecated, and emit a migration notice on use.
- No changes to generated output for existing tool × pattern combinations during the deprecation period.

### Validation Matrix

Test matrix in `tools/loop-init/test/cli.test.mjs` changes from hardcoded combinations to dynamic generation from `harnesses/*.yaml` × `starters/*/manifest.yaml`. Capability-satisfied pairs produce positive assertions; unsatisfied pairs produce negative assertions verifying fail-fast behavior. Adding a new harness requires zero test code changes.

## Consequences

### Positive

- New harness onboarding cost drops from O(P) starter copies to one manifest file.
- Pattern authoring cost drops from O(T) variants to one content set.
- Fail-fast prevents broken scaffolds for capability-mismatched combinations.
- Test coverage scales linearly with harness count, not multiplicatively.
- Terminology clarified: Harness / Tool / Foundry are now distinct, non-overlapping concepts.

### Negative

- One-time restructuring of `starters/` directory breaks in-flight validation matrix entries.
- Dynamic test matrix may reduce visibility in some CI test reporting dashboards (mitigated by fixed `[scaffold]` prefix).
- Manifest schema may need evolution as novel harness conventions emerge (mitigated by `version` field and `custom` extension point).
- Internal harnesses still require upstream PR (external registry deferred to future work).

### Neutral

- `--with-foundry` behavior unchanged; foundry remains orthogonal.
- Generated output for existing tools unchanged during deprecation period.

## Alternatives Considered

1. **Per-tool starter proliferation (status quo):** Rejected. Does not scale past ~4 tools. Already at 4 tools × 6 patterns = 24 directories with significant content duplication.

2. **External harness registry (npm packages or git repos):** Deferred. Requires trust, versioning, and security review infrastructure not yet available. Internal manifest is the prerequisite stepping stone.

3. **User-local harness config (`.loop/harness.yaml`):** Deferred. Maximum flexibility but zero shared reuse. Every user rediscovers layout conventions independently.

4. **Capability auto-detection from layout:** Rejected. Layout does not reliably imply capability (a harness may have a skills directory but no shell access). Explicit declaration is safer and more auditable.

5. **Graceful degradation instead of fail-fast:** Rejected. A scaffold that silently omits required capabilities produces loops that fail at runtime with opaque errors. Fail-fast at scaffold time is strictly better for debugging.

## Related

- Glossary terms: `Harness`, `Tool`, `Foundry`, `Pattern`, `Capability` (see `GLOSSARY.md`)
- Prior art: harness-foundry stack (`--with-foundry`) provides a parallel abstraction at the runtime level; this ADR addresses the scaffold-time abstraction.
- Future work: external harness registry, user-local overrides, capability negotiation protocol.
