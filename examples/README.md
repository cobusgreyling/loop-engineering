# Examples

Same patterns, different tools. Skills and state schemas are shared; only scheduling and invocation differ.

| Tool | Directory |
|------|-----------|
| Grok Build TUI | [grok/](./grok/) |
| Claude Code | [claude-code/](./claude-code/) |
| Codex App | [codex/](./codex/) |
| OpenClaw | [openclaw/](./openclaw/) |
| Cursor | [cursor/](./cursor/) |
| Windsurf | [windsurf/](./windsurf/) |
| Opencode | [opencode/](./opencode/) |
| Hermes Agent | [hermes/](./hermes/) |
| Gemini CLI | [primitives-matrix § Gemini CLI](../docs/primitives-matrix.md#appendix-gemini-cli) — terminal-based loops via `gemini` + external scheduling |
| GitHub Actions | [github-actions/](./github-actions/) |
| Aider CLI | [primitives-matrix § Aider](../docs/primitives-matrix.md#appendix-aider-cli) — CLI-first loops via cron + `--read` skills |
| MCP connectors | [mcp/](./mcp/) — config example, including `loop-engineering.mcp.json`; reference server in [tools/mcp-server/](../tools/mcp-server/) |

Start with [primitives-matrix.md](../docs/primitives-matrix.md) to map capabilities.

## Pattern coverage

| Pattern | Grok | Claude | Codex | OpenClaw | Cursor | Windsurf | Opencode | Hermes | GH Actions |
|---------|------|--------|-------|----------|--------|----------|----------|--------|------------|
| Daily Triage | [grok/daily-triage.md](./grok/daily-triage.md) | [claude-code/daily-triage.md](./claude-code/daily-triage.md) | [codex/daily-triage.md](./codex/daily-triage.md) | [openclaw/daily-triage.md](./openclaw/daily-triage.md) | [cursor/daily-triage.md](./cursor/daily-triage.md) | [windsurf/daily-triage.md](./windsurf/daily-triage.md) | [opencode/daily-triage.md](./opencode/daily-triage.md) | [hermes/daily-triage.md](./hermes/daily-triage.md) | [github-actions/daily-triage.yml](./github-actions/daily-triage.yml) |
| PR Babysitter | [grok/pr-babysitter.md](./grok/pr-babysitter.md) | [claude-code/pr-babysitter.md](./claude-code/pr-babysitter.md) | [codex/pr-babysitter.md](./codex/pr-babysitter.md) | [openclaw/pr-babysitter.md](./openclaw/pr-babysitter.md) | [cursor/pr-babysitter.md](./cursor/pr-babysitter.md) | [windsurf/pr-babysitter.md](./windsurf/pr-babysitter.md) | [opencode/pr-babysitter.md](./opencode/pr-babysitter.md) | [hermes/pr-babysitter.md](./hermes/pr-babysitter.md) | [github-actions/pr-babysitter.yml](./github-actions/pr-babysitter.yml) |
| CI Sweeper | [grok/ci-sweeper.md](./grok/ci-sweeper.md) | [claude-code/ci-sweeper.md](./claude-code/ci-sweeper.md) | [codex/ci-sweeper.md](./codex/ci-sweeper.md) | [openclaw/ci-sweeper.md](./openclaw/ci-sweeper.md) | [cursor/ci-sweeper.md](./cursor/ci-sweeper.md) | — | [opencode/ci-sweeper.md](./opencode/ci-sweeper.md) | — | [github-actions/ci-sweeper.yml](./github-actions/ci-sweeper.yml) |
| Post-Merge Cleanup | [grok/post-merge-cleanup.md](./grok/post-merge-cleanup.md) | [claude-code/post-merge-cleanup.md](./claude-code/post-merge-cleanup.md) | [codex/post-merge-cleanup.md](./codex/post-merge-cleanup.md) | [openclaw/post-merge-cleanup.md](./openclaw/post-merge-cleanup.md) | [cursor/post-merge-cleanup.md](./cursor/post-merge-cleanup.md) | — | [opencode/post-merge-cleanup.md](./opencode/post-merge-cleanup.md) | — | [github-actions/post-merge-cleanup.yml](./github-actions/post-merge-cleanup.yml) |
| Dependency Sweeper | [grok/dependency-sweeper.md](./grok/dependency-sweeper.md) | [claude-code/dependency-sweeper.md](./claude-code/dependency-sweeper.md) | [codex/dependency-sweeper.md](./codex/dependency-sweeper.md) | [openclaw/dependency-sweeper.md](./openclaw/dependency-sweeper.md) | [cursor/dependency-sweeper.md](./cursor/dependency-sweeper.md) | — | [opencode/dependency-sweeper.md](./opencode/dependency-sweeper.md) | — | [github-actions/dependency-sweeper.yml](./github-actions/dependency-sweeper.yml) |
| Changelog Drafter | [grok/changelog-drafter.md](./grok/changelog-drafter.md) | [claude-code/changelog-drafter.md](./claude-code/changelog-drafter.md) | [codex/changelog-drafter.md](./codex/changelog-drafter.md) | [openclaw/changelog-drafter.md](./openclaw/changelog-drafter.md) | [cursor/changelog-drafter.md](./cursor/changelog-drafter.md) | — | [opencode/changelog-drafter.md](./opencode/changelog-drafter.md) | — | [github-actions/changelog-drafter.yml](./github-actions/changelog-drafter.yml) |
| Issue Triage | [grok/issue-triage.md](./grok/issue-triage.md) | [claude-code/issue-triage.md](./claude-code/issue-triage.md) | [codex/issue-triage.md](./codex/issue-triage.md) | [openclaw/issue-triage.md](./openclaw/issue-triage.md) | [cursor/issue-triage.md](./cursor/issue-triage.md) | — | [opencode/issue-triage.md](./opencode/issue-triage.md) | — | [github-actions/issue-triage.yml](./github-actions/issue-triage.yml) |

L2 patterns ship multi-tool skills inside one starter folder — see `starters/<pattern>/`.

**Copy-paste starters**:

| Tool | Daily Triage (L1) | PR Babysitter | CI Sweeper | Dependency Sweeper | Post-Merge | Changelog | Issue Triage |
|------|-------------------|---------------|------------|-------------------|------------|-----------|--------------|
| Grok | [minimal-loop](../starters/minimal-loop/) | [pr-babysitter](../starters/pr-babysitter/) | [ci-sweeper](../starters/ci-sweeper/) | [dependency-sweeper](../starters/dependency-sweeper/) | [post-merge-cleanup](../starters/post-merge-cleanup/) | [changelog-drafter](../starters/changelog-drafter/) | [issue-triage](../starters/issue-triage/) |
| Claude Code | [minimal-loop-claude](../starters/minimal-loop-claude/) | via `loop-init --tool claude` | via `loop-init --tool claude` | via `loop-init --tool claude` | via `loop-init --tool claude` | via `loop-init --tool claude` | via `loop-init --tool claude` |
| Codex | [minimal-loop-codex](../starters/minimal-loop-codex/) | via `loop-init --tool codex` | via `loop-init --tool codex` | via `loop-init --tool codex` | via `loop-init --tool codex` | via `loop-init --tool codex` | via `loop-init --tool codex` |
| OpenClaw | [openclaw/daily-triage.md](./openclaw/daily-triage.md) (manual) | [openclaw/pr-babysitter.md](./openclaw/pr-babysitter.md) | [openclaw/ci-sweeper.md](./openclaw/ci-sweeper.md) | [openclaw/dependency-sweeper.md](./openclaw/dependency-sweeper.md) | [openclaw/post-merge-cleanup.md](./openclaw/post-merge-cleanup.md) | [openclaw/changelog-drafter.md](./openclaw/changelog-drafter.md) | [openclaw/issue-triage.md](./openclaw/issue-triage.md) |
| Hermes | [hermes/daily-triage.md](./hermes/daily-triage.md) (manual) | [hermes/pr-babysitter.md](./hermes/pr-babysitter.md) (manual) | — | — | — | — | — |
| Opencode | [minimal-loop-opencode](../starters/minimal-loop-opencode/) | [pr-babysitter-opencode](../starters/pr-babysitter-opencode/) | [ci-sweeper-opencode](../starters/ci-sweeper-opencode/) | [dependency-sweeper-opencode](../starters/dependency-sweeper-opencode/) | [post-merge-cleanup-opencode](../starters/post-merge-cleanup-opencode/) | [changelog-drafter-opencode](../starters/changelog-drafter-opencode/) | [issue-triage-opencode](../starters/issue-triage-opencode/) |
