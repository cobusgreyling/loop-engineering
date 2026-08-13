# loop-audit

CLI that scores a project's **Loop Readiness** (0–100) and suggests next steps.

**npx @cobusgreyling/loop-audit . --suggest** works immediately (published package).

## Install & Run

**npm (recommended):**

```bash
npx @cobusgreyling/loop-audit .
npx @cobusgreyling/loop-audit . --suggest
```

**From this repo:**

```bash
# readiness-core is a monorepo sibling (file: dep) — prebuild builds it for you
cd tools/loop-audit
npm install
npm run build   # runs prebuild → builds ../readiness-core, then tsc
node dist/cli.js /path/to/your/project
```

## Before/after demo

See scores climb from empty → L1 starter → L2 verifier:

```bash
bash scripts/before-after-demo.sh
```

## Options

```bash
loop-audit .              # human-readable (default)
loop-audit . --json       # machine-readable
loop-audit . --md         # markdown report
loop-audit . --suggest    # copy-from-template commands + activity tips (all tools)
loop-audit . --badge      # markdown README badge (Loop Ready level + score)
```

Exit code `2` if score < 40 (useful for CI gates once your project is loop-ready).

## Publish to npm

Maintainers:

```bash
cd tools/loop-audit
npm run build
npm publish --access public
```

## Signals Checked (v1.7+)

| Signal                  | Notes |
|-------------------------|-------|
| State file              | STATE.md or pattern-specific |
| Triage skill            | loop-triage / ci-triage / pr-review-triage etc. |
| Verifier skill          | maker/checker split (skills or Claude/Codex agents) |
| LOOP.md / config        | Cadence, limits, handoff |
| AGENTS.md / CLAUDE.md   | Project conventions |
| Safety docs             | safety.md + LOOP.md mentions of gates |
| .github/ + workflows    | Dogfooding / automation |
| MCP / connectors        | Mentions or config files |
| Worktree evidence       | Isolation patterns in docs |
| patterns/registry.yaml  | Machine index for tooling |
| loop-budget.md          | Token caps and kill switch |
| loop-run-log.md         | Append-only run history |
| LOOP.md budget section  | Cadence limits documented in config |
| loop-budget skill       | Runtime budget guard |
| Least-privilege tool scope | `allowed-tools` in SKILL.md, or documented tool/MCP scopes (agents get only what their role needs) |
| Stall / no-progress detection | loop-context circuit breaker, a ledger, or a documented max-attempts / no-progress rule |
| Human-escalation path   | LOOP.md / safety docs define when to stop and hand off to a human |
| **loopActivity (v1.4)** | **Dynamic proof**: "Last run" timestamps in state, loop-related git commits, scheduled workflows, run logs |
| **Harness Runtime (v1.7)** | `.foundry/stack.yaml`, lock, sessions/traces, outerloop emit, host integrate — LE → [harness-foundry](https://github.com/cobusgreyling/harness-foundry) funnel |

When score ≥ 80 and no `.foundry/stack.yaml`, audit recommends:

```bash
npx @cobusgreyling/loop-init . --with-foundry
```

L3 requires verifier + state + cost observability (budget + run log + LOOP.md budget) **and** proven loop activity (not just files on disk).

## Levels

| Level | Meaning |
|-------|---------|
| L0 | Draft — document intent |
| L1 | Report-only loops |
| L2 | Assisted auto-fix with verifier |
| L3 | Unattended-capable (with human gates) |

See [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md).