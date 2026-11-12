# 01: Harness manifest schema and loader

**What to build:** A harness manifest at `harnesses/<id>.yaml` can be parsed into a type-safe Harness object. Unknown harness IDs produce a clear error message. Built-in manifests for the four existing tools (claude, grok, codex, opencode) are written with correct layout fields and backward-compatible aliases.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Harness manifest YAML schema defined with fields: id, display_name, version, layout (skills_dir, skill_filename, agents_dir, config_file), capabilities (shell, file_write, skill_read, worktree, sub_agent, scheduling, mcp), aliases
- [ ] Loader function parses YAML into typed Harness object with validation
- [ ] Unknown harness ID returns structured error naming the missing manifest
- [ ] Four built-in manifests written: harnesses/claude.yaml, harnesses/grok.yaml, harnesses/codex.yaml, harnesses/opencode.yaml
- [ ] Each built-in manifest includes aliases field mapping legacy --tool values
- [ ] Unit tests cover: valid parse, missing field rejection, unknown ID error, alias resolution
