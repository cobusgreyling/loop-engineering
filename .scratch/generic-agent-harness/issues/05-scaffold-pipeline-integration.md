# 05: Scaffold pipeline integration (expand)

**What to build:** `loop-init --tool <harness-id>` resolves the harness from a manifest, runs capability check, maps content files per layout, and scaffolds successfully. Legacy `--tool claude/grok/codex/opencode` continues working through aliases. Old and new routing paths coexist; old path is NOT deleted yet (expand phase).

**Blocked by:** 03 (Capability checker with fail-fast), 04 (Content-to-layout file mapper)

**Status:** ready-for-agent

- [ ] CLI resolves --tool value through alias lookup to harness manifest
- [ ] New manifest-driven scaffold path integrated alongside existing tool-enum path
- [ ] Capability check runs before any files are written
- [ ] File mapper output drives actual file writes to target directory
- [ ] Existing --tool claude/grok/codex/opencode commands produce identical output to before
- [ ] Integration test: scaffold into temp dir with new harness ID produces correct file structure
- [ ] Integration test: legacy --tool values still work unchanged
