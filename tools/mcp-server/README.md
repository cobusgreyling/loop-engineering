# @cobusgreyling/loop-mcp-server

MCP (Model Context Protocol) server for **loop-engineering** — exposes patterns, skills, state, budget, and audit tools as runtime-queryable resources for AI agents.

Instead of stuffing all loop documentation into the prompt, agents can query only what they need on-demand via MCP.

## Quick Start

```bash
npx @cobusgreyling/loop-mcp-server
```

From a cloned `loop-engineering` repo:

```bash
cd tools/mcp-server && npm ci && npm test
node dist/index.js
```

Set `LOOP_PROJECT_ROOT` to your target project (defaults to `cwd`).

### Configure in Claude Code / Grok / any MCP client

Add to your MCP config (`.mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "loop-engineering": {
      "command": "npx",
      "args": ["-y", "@cobusgreyling/loop-mcp-server"],
      "env": {
        "LOOP_PROJECT_ROOT": "."
      }
    }
  }
}
```

## Resources

| URI | Description |
|-----|-------------|
| `loop://registry` | Pattern registry (all 7 patterns with metadata, costs, phases) |
| `loop://config` | LOOP.md — cadence, budget, gates, scheduling |
| `loop://budget` | loop-budget.md — token caps, kill switch |
| `loop://run-log` | loop-run-log.md — append-only run history |
| `loop://safety` | Safety docs — denylists, auto-merge policy, MCP scopes |
| `loop://patterns/{id}` | Full pattern documentation by ID |
| `loop://skills/{name}` | Skill definition (SKILL.md) by name |
| `loop://state/{file}` | State file content |

## Tools

| Tool | Description |
|------|-------------|
| `loop_list_patterns` | List all patterns with goals, cadences, risk levels |
| `loop_list_skills` | List available skills with locations |
| `loop_list_state_files` | List state files in the project |
| `loop_get_pattern` | Get full pattern docs + registry metadata |
| `loop_get_skill` | Get SKILL.md content for a named skill |
| `loop_get_state` | Read a state file for current loop status |
| `loop_recommend_pattern` | Recommend patterns for a use case description |
| `loop_estimate_cost` | Estimate daily token cost for a pattern at L1/L2/L3 |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `LOOP_PROJECT_ROOT` | `cwd()` | Root directory of the project to serve |

## Development

```bash
cd tools/mcp-server
npm install
npm run build
npm test
```

## Architecture

```
Agent (Claude Code / Grok / Codex)
  │
  ├─ MCP Resource Read ──→ loop://patterns/daily-triage
  ├─ MCP Tool Call ──→ loop_recommend_pattern("watch CI failures")
  └─ MCP Tool Call ──→ loop_estimate_cost("ci-sweeper", "L2")
  │
  ▼
loop-mcp-server (stdio transport)
  │
  ├─ resolver.ts ──→ reads patterns/, skills/, STATE.md, LOOP.md, etc.
  └─ index.ts ──→ MCP protocol handlers
```

The server reads from the local filesystem at `LOOP_PROJECT_ROOT`. It is read-only — it never writes to the project.

## See Also

- [Loop Engineering Patterns](../../patterns/)
- [MCP Examples](../../examples/mcp/)
- [Primitives: Plugins & Connectors](../../docs/primitives.md)
- [Safety: MCP Least Privilege](../../docs/safety.md)
