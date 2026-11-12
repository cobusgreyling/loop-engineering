# 02: Pattern manifest schema and loader

**What to build:** A pattern manifest at `starters/<pattern>/manifest.yaml` can be parsed. The `required_capabilities` field is readable. Manifest files for all existing patterns are written with correct capability declarations.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Pattern manifest YAML schema defined with fields: id, required_capabilities (list of capability names), optional metadata
- [ ] Loader function parses YAML into typed PatternManifest object with validation
- [ ] Manifest files written for each existing pattern under starters/<pattern>/manifest.yaml
- [ ] Each manifest declares required_capabilities matching the pattern's actual dependencies (e.g., pr-babysitter requires worktree)
- [ ] Unit tests cover: valid parse, missing required_capabilities rejection, unknown capability name warning
