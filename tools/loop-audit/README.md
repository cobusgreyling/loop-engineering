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
| **Guardrail proof** | `loop-drill.json` from [`loop-drill --record`](../loop-drill): the gate, breaker and verifier shown firing — see below |

When score ≥ 80 and no `.foundry/stack.yaml`, audit recommends:

```bash
npx @cobusgreyling/loop-init . --with-foundry
```

L3 requires verifier + state + cost observability (budget + run log + LOOP.md budget), proven loop activity (not just files on disk), **and proven guardrails**: a `loop-drill.json` showing the current `gate.yaml` passing its drills, with no recorded guardrail failing.

## Present is not proven

Every signal counts content, not filenames:

- **Empty files don't score.** A file that is empty or whitespace, or JSON that is just `{}` / `[]`, is a placeholder. The audit lists each one under *Not counted* instead of crediting it.
- **Skills must load.** A skill is a directory with a `SKILL.md` that has `name` and `description` frontmatter, which every host needs before it will invoke it. The same goes for a Claude Code verifier agent. A bare directory, or a file with no frontmatter, doesn't count, whatever it's called.
- **`gate.yaml` must be a policy.** It needs `version: 1` and a `denylist:`. Anything else would be refused by `loop-gate`, so it earns nothing and is reported as a failure.

Files can only show a guardrail is configured. [`loop-drill`](../loop-drill) shows whether it fires, by running it against a seeded fault and a benign case. Record the results and commit them:

```bash
npx @cobusgreyling/loop-drill . --record          # gate + breaker: offline, no tokens
npx @cobusgreyling/loop-drill . --only verifier --verifier-cmd "npm test" --setup "npm ci" --record
git add loop-drill.json
```

The audit reads the record per guardrail:

| Result | Meaning | Effect |
|---|---|---|
| **proven** | A drill caught the fault **and** a drill let the benign case through, and nothing failed | Counts. The gate being proven is required for L3 |
| **failed** | A drill failed: the guardrail didn't fire, or blocked the benign case | The guardrail's points are withdrawn (gate → `gateYaml`, verifier → `verifier`, breaker → stall detection), and L3 is blocked |
| **untested** | Every drill was skipped, or only one direction passed | Not proven. For the gate this means `loop-gate` couldn't drill it, so `gateYaml` is withdrawn |
| **stale** | The gate was drilled against a different `gate.yaml`, or a canary (verifier, injection) is over 30 days old | Ignored until re-recorded |

The gate proof is tied to a sha256 of `gate.yaml` (line endings normalised), so weakening the policy after recording drops L3 until the drills are run again. Gate and breaker drills are deterministic, so they don't expire otherwise.

The record is a claim the repo makes about itself, like a `Last run:` timestamp, so a determined author can hand-write one. Re-run the drills in CI to keep it honest; this repo's own CI does (see `scripts/ci-validate-gates.sh` and `scripts/ci-audit-gates.sh`).

## Levels

| Level | Meaning |
|-------|---------|
| L0 | Draft — document intent |
| L1 | Report-only loops |
| L2 | Assisted auto-fix with verifier |
| L3 | Unattended-capable (with human gates) |

See [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md).