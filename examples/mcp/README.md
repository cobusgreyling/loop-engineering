# MCP / Connectors Cookbook

Practical, scoped examples for connecting loops to real tools via MCP (or equivalent plugins/connectors).

**Core principle**: Give loops the *minimum* privilege they need. Prefer read + comment over write. Use human gates + worktrees for anything that mutates state.

## Run the loop-engineering MCP server

If you want to try the MCP server without cloning the repo, use the published package:

```bash
LOOP_PROJECT_ROOT=. npx @cobusgreyling/loop-mcp-server
```

Copy the example MCP configuration:

```bash
cp examples/mcp/loop-engineering.mcp.json <your-mcp-config-location>
```

Then point your MCP client to the command above.

The local clone/dev path still works if you want to inspect or change the server implementation directly; see the example configuration files below.

## Quick Patterns

| Connector | Typical Use | Recommended Scope | Pattern Fit |
|-----------|-------------|-------------------|-------------|
| GitHub (read + propose) | Discover PRs/issues, post comments, open draft PRs | `contents: read`, `pull_requests: write` (with bot identity) | PR Babysitter, Daily Triage, Changelog Drafter |
| Linear | Read/update issues from state, create follow-up tickets | API key with project + issue write limited to specific teams | Post-Merge, Dependency Sweeper, CI Sweeper |
| Slack (read) | Ingest threads / alerts the loop should triage | Read-only on specific channels | Daily Triage |
| Safe propose flow | Any write action | Loop opens PR / draft / comment. Human merges or approves. | All L2+ patterns |
| Knos (shared state) | Give parallel loops one state record instead of one STATE.md each | Local only; no network, no account | Anti-pattern 5, PR Babysitter, Daily Triage |

## Example Configurations

See the files in this directory:

- `loop-engineering.mcp.json` — starter config for the published MCP server.
- `github-readonly.mcp.json` (existing) — safe starting point for discovery.
- `github-propose.json` — read + limited write for comments and draft PRs (sign comments as the loop).
- `linear.json` — example for creating/updating issues from loop state.
- `slack-read.json` — ingest channel threads into triage.
- `knos.mcp.json` — local shared state for parallel loops (`pip install knos`,
  Python 3.10+). The record lives in `.knos/decisions.md` in the repo, so a fresh
  clone reads it with nothing installed; the server is only needed for live claims.
- `safe-write-pattern.md` — the recommended architecture for any mutating action.

## Usage in a Loop Prompt (Grok example)

```
/loop 1d Use the github-propose MCP. Scan open PRs with pr-review-triage. For actionable low-risk items on allowlisted paths: open worktree, minimal-fix, verifier. Then post a signed comment on the PR with a link to the worktree diff. Never merge.
```

Always:
- Declare the bot identity in comments ("🤖 Loop Engineering — Changelog Drafter").
- Record the MCP action + result in STATE or the pattern-specific state file.
- Have an explicit denylist in the skill or LOOP.md.

## Safety Notes

- Never give a loop the ability to push tags or create releases without an explicit human gate (even for changelog).
- For Linear / ticketing: the loop can *propose* or *update* status; a human (or a very trusted allowlist) does final close on high-severity items.
- Test new connectors in report-only (L1) mode first.
- Log every MCP call the loop makes (the `monitor` tool or GitHub Action logs are your friend).

See also: [docs/safety.md](../../docs/safety.md), [docs/operating-loops.md](../../docs/operating-loops.md), and the individual pattern docs for human gate recommendations.