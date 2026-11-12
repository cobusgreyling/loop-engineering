# 04: Content-to-layout file mapper

**What to build:** Given a Harness layout and a content directory path, the mapper produces a list of source-to-target path mappings. Pure function; no IO. This is the translation layer between tool-agnostic content and harness-specific file locations.

**Blocked by:** 01 (Harness manifest schema and loader)

**Status:** ready-for-agent

- [ ] Mapper function accepts Harness layout + content base path, returns array of {source, target} mappings
- [ ] Skills mapped to harness.layout.skills_dir with harness.layout.skill_filename convention
- [ ] Agent prompts mapped to harness.layout.agents_dir
- [ ] Config file handling respects null (no config_file = skip)
- [ ] Unit tests cover: standard layout mapping, null config_file, nested content directories
