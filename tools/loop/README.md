# @cobusgreyling/loop

**Unified front door** for [Loop Engineering](https://github.com/cobusgreyling/loop-engineering) CLIs.

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop doctor .
```

This package does **not** replace `loop-init`, `loop-audit`, or the other tools. It wraps them and adds **doctor** + **status** so week-one activation is one mental model.

| Command | Delegates to | Notes |
|---------|--------------|--------|
| `loop init` | `@cobusgreyling/loop-init` | Scaffold pattern + tool |
| `loop audit` | `@cobusgreyling/loop-audit` | Loop Ready score |
| `loop cost` | `@cobusgreyling/loop-cost` | Token estimates |
| `loop sync` | `@cobusgreyling/loop-sync` | STATE ↔ LOOP drift |
| `loop doctor` | audit + sync + files | **New** — top 3 actions, exit codes |
| `loop status` | files + audit | **New** — run-log dashboard |
| `loop badge` | `loop-audit --badge` | README badge |
| `loop context` | `@cobusgreyling/loop-context` | Circuit breaker / memory |
| `loop worktree` | `@cobusgreyling/loop-worktree` | Isolated fix attempts |
| `loop gate` | `@cobusgreyling/loop-gate` | Path policy + evidence-aware PR promotion |
| `loop mcp` | `@cobusgreyling/loop-mcp-server` | MCP server |
| `loop sandbox` | `@cobusgreyling/loop-sandbox` | Sandbox helper (if present) |

## Week-one path

```bash
# 1. Scaffold (report-only)
npx @cobusgreyling/loop init . --pattern daily-triage --tool grok

# 2. One health check
npx @cobusgreyling/loop doctor .

# 3. Optional cost estimate
npx @cobusgreyling/loop cost -p daily-triage -l L1 -c 1d

# 4. Day-2 dashboard
npx @cobusgreyling/loop status .
```

### Doctor exit codes

| Code | Meaning |
|------|---------|
| `0` | Healthy |
| `1` | Warnings (gaps, mild drift, incomplete budget/run-log) |
| `2` | Blocked (score &lt; 40, critical drift, or not scaffolded) |

```bash
npx @cobusgreyling/loop doctor . --json
npx @cobusgreyling/loop status . --json
```

## Compatibility (old doors stay open)

These continue to work forever (or until a future major with long deprecation):

```bash
npx @cobusgreyling/loop-init .
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern daily-triage
npx @cobusgreyling/loop-sync .
```

`loop <cmd>` is the same binary behavior for pass-through commands.

## Monorepo develop

```bash
# Build sibling tools first (audit + sync used by doctor)
(cd ../readiness-core && npm ci && npm run build)
(cd ../loop-audit && npm ci && npm run build)
(cd ../loop-sync && npm ci && npm run build)
(cd ../loop-init && npm ci && npm run build)

cd ../loop
npm ci
npm test
node dist/cli.js doctor ../..
node dist/cli.js status ../..
```

## Agent skill

See [`skills/install-loop`](../../skills/install-loop/) in the monorepo — a short skill agents can follow to install and doctor a project.

## License

MIT
