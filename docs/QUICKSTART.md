# Quickstart — 5 minutes to your first loop

> **Stop prompting. Design the loop. Get a score.**

Watch the score climb: [loop-audit-demo.gif](../assets/visuals/loop-audit-demo.gif) (10 → 70 → 100 in ~15s).

Landed from [X](https://x.com), the [showcase](https://cobusgreyling.github.io/loop-engineering/), or a friend's README? This is the shortest path from zero to a running loop.

**Week one rule:** report only. No auto-fix, no auto-merge. Read what the loop writes before you let it act.

**Front door:** prefer the unified CLI (`@cobusgreyling/loop`). Dedicated packages (`loop-init`, `loop-audit`, …) stay fully supported — see [cli-front-door.md](./cli-front-door.md).

## 1. Pick your pain (30 seconds)

Have a **feature or refactor** to finish, not a maintenance cadence? That is a different job — see [jobs.md](./jobs.md) and the [refactor / change path](./refactor.md). Do not point `daily-triage` at a whole-repo rewrite.

Not sure which loop? Use the [interactive pattern picker](https://cobusgreyling.github.io/loop-engineering/#interactive) on the showcase — it recommends a pattern, scaffold command, first `/loop` line, and a token estimate.

Or start with **Daily Triage** if you just want to learn loop discipline with low risk.

## 2. Scaffold in your repo (60 seconds)

Run this in the root of any git project (no clone required):

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
# One health check (audit + sync + top 3 actions):
npx @cobusgreyling/loop doctor .
# Optional one-command funnel into harness-foundry:
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude --with-foundry
```

Equivalent (old door, still supported):

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude
```

Swap `--pattern` for any pattern from [patterns/registry.yaml](../patterns/registry.yaml). List all patterns:

```bash
npx @cobusgreyling/loop init --help
```

### Which `--tool` values work?

| `--tool` value | Scaffolded by `loop-init`? | Notes |
|----------------|---------------------------|-------|
| `claude` | Yes (default) | Native `/loop` + `$skill` invocation |
| `grok` | Yes | Native `/loop` scheduling |
| `codex` | Yes | Automations tab for scheduling |
| `opencode` | Yes | Cron/systemd + `opencode run` |
| `cursor` | No — manual copy | Copy skills + `STATE.md`; use Automations — see [examples/cursor/](../examples/cursor/) |
| `windsurf` | No — manual copy | Copy skills + `STATE.md`; use Workflows — see [examples/windsurf/](../examples/windsurf/) |
| `openclaw` | No — manual copy | Copy `skills/` + `STATE.md`; use `openclaw cron` — see [examples/openclaw/](../examples/openclaw/) |

`loop-init` copies the starter kit, creates `STATE.md`, `LOOP.md`, `loop-budget.md`, and `loop-run-log.md`, then **prints your Loop Ready score** and first command.

## 3. Check cost before you schedule (30 seconds)

```bash
npx @cobusgreyling/loop cost --pattern daily-triage --level L1 --cadence 1d
# same as: npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d
```

Adjust `--pattern`, `--level` (L1 → L2 → L3), and `--cadence` to match what you plan to run. High-frequency loops (CI Sweeper at 5m) can burn tokens fast — slow the cadence or require early-exit triage first.

### Circuit breaker for L2+ loops (optional)

When a loop starts fixing code unattended, wire a **circuit breaker** so it escalates instead of retrying the same failure forever. `loop-init` scaffolds `loop-ledger.json` and a `loop-guard` skill for fix-capable patterns; check the ledger before each retry:

```bash
npx @cobusgreyling/loop context --check --ledger loop-ledger.json
# same as: npx @cobusgreyling/loop-context --check --ledger loop-ledger.json
```

Exit `0` = continue · `2` = escalate to a human. The breaker trips on max iterations, the same error repeating N× in a row, too many consecutive failures, or a token budget cap. Full API: [tools/loop-context/README.md](../tools/loop-context/README.md).

#### Token budget negotiation (`budget-negotiator`)

When an L3 autonomous loop reaches ≥90% of its daily token cap in `loop-budget.md` with critical `High Priority` items remaining, it can use the [`budget-negotiator`](../skills/budget-negotiator/SKILL.md) skill to request an extension instead of an abrupt hard stop.

- **Negotiation vs Hard Exit:** Standard `loop-budget` exits immediately when over cap. `budget-negotiator` calculates current ROI, drafts a structured budget bump request (`+20%` or max `+50k` tokens, once per day), and appends it to `STATE.md` under `[BUDGET NEGOTIATION]`.
- **Human Gate Safety:** Agents are **strictly forbidden** from self-raising token caps in `loop-budget.md`. A human maintainer must explicitly approve the request by editing `loop-budget.md` before the loop can resume.

## 4. Audit readiness (30 seconds)

```bash
# Prefer doctor for day-to-day (includes audit + sync)
npx @cobusgreyling/loop doctor .
# Or audit alone:
npx @cobusgreyling/loop audit . --suggest
```

Scores 0–100 with concrete next steps. Re-run after each improvement. Paste a badge when you're proud of the score:

```bash
npx @cobusgreyling/loop badge .
```

When the score is **≥ 80**, audit (and `loop init`) nudge you to version the loop as a [harness-foundry](https://github.com/cobusgreyling/harness-foundry) stack — declarative runtime, traces, outerloop emit:

```bash
npx @cobusgreyling/loop init . --with-foundry
npx @cobusgreyling/harness-foundry validate
npx @cobusgreyling/harness-foundry run --goal "Verify harness wiring"
```

To configure provider-specific stacks like **MiniMax** during scaffolding:

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude \
  --with-foundry --model-provider minimax --region global_en --model MiniMax-M3
```

> **MiniMax Foundry flags:**
> - `--model-provider minimax`
> - `--region`: `global_en` (default) | `cn_zh`
> - `--model`: e.g. `MiniMax-M3`
>
> See [harness-foundry](https://github.com/cobusgreyling/harness-foundry) for full provider and stack runtime documentation.

### Catch drift before you schedule (`loop sync`)

`loop audit` scores readiness; `loop sync` checks that your `STATE.md` and `LOOP.md` still agree. When they drift — you edit `LOOP.md` to add a loop but never wire it into `STATE.md`, or a starter update leaves one file behind — a scheduled loop can run against stale instructions. `loop doctor` runs this for you.

```bash
npx @cobusgreyling/loop sync .
# same as: npx @cobusgreyling/loop-sync .
```

Sample output on a fresh daily-triage scaffold:

```
Loop Sync Report
══════════════════════════════════════════════════
Score: 80/100 (healthy)

Found 2 issue(s):

⚠️ Warnings:
   - LOOP.md: LOOP.md does not reference STATE.md
   - STATE.md ↔ LOOP.md: Low structural similarity between STATE.md and LOOP.md

💡 Suggestions:
   - Review STATE.md and LOOP.md for consistency
```

Read it top-down: the **score** (70+ healthy, 40–69 warning, below 40 needs attention) is the headline, then each **warning** names the two files that disagree and how. Here, `LOOP.md` describes loops that never point back at `STATE.md` — expected right after scaffolding, worth fixing once you customize either file.

**When to run it:** after editing `LOOP.md`, and again before you schedule an L2 loop — so an unattended run never fires on stale state. Full checks, options, and score bands: [tools/loop-sync/README.md](../tools/loop-sync/README.md).

### Optional: MCP runtime lookup

Agents can query patterns, skills, and state on demand instead of stuffing docs into every prompt. Copy the config stub from [examples/mcp/loop-engineering.mcp.json](../examples/mcp/loop-engineering.mcp.json) into your MCP client settings.

Run the server from npm (no clone required):

```bash
LOOP_PROJECT_ROOT=. npx @cobusgreyling/loop-mcp-server
```

Or from a cloned `loop-engineering` repo for local development:

```bash
cd path/to/loop-engineering/tools/mcp-server && npm ci && npm run build
LOOP_PROJECT_ROOT=/path/to/your/project node dist/index.js
```

See [tools/mcp-server/README.md](../tools/mcp-server/README.md) for resources and tools.

## 4b. Set the merge gate (30 seconds)

Before any loop can auto-merge, it needs a `gate.yaml` defining what's off-limits and what's safe to merge unattended. Copy the starter from [templates/gate.yaml.template](../templates/gate.yaml.template) into your repo root as `gate.yaml`:

```yaml
version: 1
denylist:
  - "src/auth/**"
  - "**/*.env"
autoMergeAllowlist:
  - "docs/**"
  - "**/*.md"
```

This is **not** a free-form list of gates — `denylist` and `autoMergeAllowlist` are fixed keys `loop-gate` checks against (there's also an optional `maxFiles` cap — see the full template for details).

Enforce it mechanically before any auto-merge action:

```bash
npx @cobusgreyling/loop gate check --action auto-merge --paths <f1,f2,...>
# same as: npx @cobusgreyling/loop-gate check --action auto-merge --paths <f1,f2,...>
```

Exit `0` = allowed · `2` = escalate to a human. Already running `loop-audit --auto-fix`? It emits a loadable `gate.yaml` for you automatically — no need to hand-write one.

See [tools/loop-gate/README.md](../tools/loop-gate/README.md) for the full policy schema and [docs/safety.md](./safety.md) for the risk/mitigation model this gate enforces.

## 5. Run your first loop — report only (2 minutes)

### Grok

```bash
/loop 1d Run loop-triage. Update STATE.md. No auto-fix in week one.
```

### Claude Code

```bash
/loop 1d Run $loop-triage. Read STATE.md. Merge findings into High Priority and Watch List. Update Last run. Do not edit code.
```

### Codex

Use the first-run command printed by `loop-init` (pattern-specific). Week one: triage and state updates only.

### OpenClaw

No `loop-init --tool openclaw` yet — copy `skills/loop-triage/SKILL.md` and `STATE.md`, then create an isolated cron job. See [examples/openclaw/daily-triage.md](../examples/openclaw/daily-triage.md).

### Opencode

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool opencode
```

Then schedule with cron or systemd — each tick runs headless via `opencode run`:

```bash
opencode run "Run loop-triage. Read STATE.md first. Update High Priority and Watch List. No auto-fix in week one." --agent loop-triage
```

See [examples/opencode/daily-triage.md](../examples/opencode/daily-triage.md) for worktree + verifier patterns (L2+).

### Hermes

No `loop-init --tool hermes` yet — install the `loop-triage` skill manually and schedule via `hermes cron`. See [examples/hermes/daily-triage.md](../examples/hermes/daily-triage.md) for setup, channel delivery, and the full command reference.

Week one: use `--deliver local` so routine triage output stays out of your chat history until you trust it.

### Cursor

No `loop-init --tool cursor` yet — copy skills and state from any starter, then map scheduling to editor Automations. See [examples/cursor/daily-triage.md](../examples/cursor/daily-triage.md).

### Windsurf

No `loop-init --tool windsurf` yet — copy skills and state from any starter, then map scheduling to a Cascade Workflow. See [examples/windsurf/daily-triage.md](../examples/windsurf/daily-triage.md).

### GitHub Actions only

Workflow examples under [examples/github-actions/](../examples/github-actions/) are schema-complete; you wire the agent invocation (Codex API, `repository_dispatch`, etc.). Start with report-only outputs to a state file or issue comment.

### GitHub Actions composite action (`loop-action`)

For CI/CD workflows, use the official GitHub Composite Action [`tools/loop-action`](../tools/loop-action/README.md) to automatically run readiness audits (`loop-audit`), enforce circuit breakers (`loop-context`), and isolate execution in worktrees (`loop-sandbox`):

```yaml
- uses: cobusgreyling/loop-engineering/tools/loop-action@main
  with:
    pattern: 'ci-sweeper'
    level: 'L1'            # L1 (report-only) -> L2 -> L3
    sandbox: 'false'       # set 'true' for ephemeral worktree isolation (L2)
    command: |
      npx grok-cli run --skill .grok/skills/ci-sweeper/SKILL.md
```

> **Week-one rule:** report-only mode (`level: 'L1'`). No auto-fix, no auto-merge. Review generated state output before enabling actions.
>
> **Note on `command`:** Unquoted multi-arg command strings can be fragile when parsed by shell runners. Prefer multi-line `command: |` blocks or a single script path (e.g. `scripts/run-agent.sh`).
>
> See [tools/loop-action/README.md](../tools/loop-action/README.md) and [docs/safety.md](./safety.md) for action inputs, security guardrails, and permission boundaries.

## 6. Read the output, commit state (1 minute)

Open `STATE.md`. Did the loop capture real priorities? Edit anything wrong — you're still the engineer.

Commit the scaffold + first run update so `loop-audit` sees activity on the next audit.

## What next?

| When | Do this |
|------|---------|
| End of week one | Re-run `loop-audit . --suggest` — aim for L1 (score ~40+) |
| Week two | Add a verifier skill; try one assisted fix in a worktree (L2) — see [loop-worktree](#l2-isolated-fix-attempts-loop-worktree) below |
| Before unattended (L3) | `loop-budget.md` + `loop-run-log.md` filled, human gates in `LOOP.md`, proven runs |
| Unsure which pattern | [pattern-picker.md](./pattern-picker.md) · [loop-design-checklist.md](./loop-design-checklist.md) |
| Something broke | [failure-modes.md](./failure-modes.md) · [stories/](../stories/) |

### L2: isolated fix attempts (`loop-worktree`)

PR Babysitter and CI Sweeper need **one git worktree per fix attempt** so retries don't collide on the same branch. `loop-worktree` tracks them in a manifest and sweeps rejected attempts.

```bash
# Create an isolated worktree for one fix attempt
npx @cobusgreyling/loop-worktree create --run-id pr-217-fix-1 --pattern pr-babysitter

# Run your fix in the worktree path printed by create, then verifier...

# Verifier rejected — mark for cleanup (audit trail only)
npx @cobusgreyling/loop-worktree mark --run-id pr-217-fix-1 --status rejected

# Sweep rejected/escalated worktrees older than 24h
npx @cobusgreyling/loop-worktree cleanup --older-than 24h

# List active worktrees
npx @cobusgreyling/loop-worktree list
```

To prevent multi-loop collisions on shared paths across concurrent runs, use advisory path locks via CLI or public JS import:

```bash
# CLI advisory lock (skips or queues if another owner holds an overlapping path)
npx @cobusgreyling/loop-worktree lock --paths package.json,package-lock.json --owner dependency-sweeper --ttl 6h
npx @cobusgreyling/loop-worktree unlock --owner dependency-sweeper
```

Programmatic loops can import lock primitives directly from `@cobusgreyling/loop-worktree/lock` without deep-importing internal files under `dist/`:

```js
import { lockPaths, unlockOwner, LOCKS_DIR } from '@cobusgreyling/loop-worktree/lock';

await lockPaths({ root, owner, paths, ttl: '6h' });
await unlockOwner(root, owner);
```

Pair with the [circuit breaker](#circuit-breaker-for-l2-loops-optional) above: when `loop-context --check` exits `2`, mark the worktree `escalated` before handing off to a human. The two tools stay independent — see [tools/loop-worktree/README.md](../tools/loop-worktree/README.md).

### Ephemeral worktree isolation (`loop-sandbox`)

To run an agent command in a temporary, isolated git worktree and capture its changes as a reviewable `.patch` file without touching your working tree, use `loop-sandbox` ([tools/loop-sandbox/README.md](../tools/loop-sandbox/README.md)). It automatically spawns a clean worktree from HEAD, executes your process, captures all edits (including untracked files) into a `.patch` file, and destroys the worktree so your repo stays pristine.

```bash
# Run an agent command in an ephemeral sandbox
npx @cobusgreyling/loop-sandbox run -- npx my-agent

# Optional --shell to run raw shell commands (e.g. bash -c)
npx @cobusgreyling/loop-sandbox run --shell -- bash -c "echo 'fix' > file.txt"

# List and review generated patches before applying
npx @cobusgreyling/loop-sandbox review
git apply .loop-sandbox/patches/<patch-id>.patch
```

> **Windows compatibility:** On Windows, npm `.cmd` shims (`npx`, `tsc`, etc.) that fail with `ENOENT` are automatically retried through a shell, so you do not need to pass `--shell` just for `npx`.
>
> **Safety note:** `loop-sandbox` provides worktree isolation, but process execution retains OS-level filesystem and network access — see [docs/safety.md](./safety.md). Always inspect patch files before running `git apply`.

### Multi-agent consensus sandboxing (`loop-swarm`)

For high-confidence L3 operations, `loop-swarm` ([tools/loop-swarm/README.md](../tools/loop-swarm/README.md)) runs an agent command multiple times sequentially across `N` (default: 3) isolated `loop-sandbox` worktrees. It hashes the resulting `.patch` files and verifies that a majority produced byte-identical changes before writing a consensus patch to `.loop-sandbox/patches/consensus.patch`.

If an agent produces non-deterministic edits, `loop-swarm` acts as a consensus safety net by accepting only changes independently reproduced across runs.

```bash
# Run multi-agent consensus across 3 sequential sandboxes
npx @cobusgreyling/loop-swarm run --count 3 -- <agent-cmd>
```

> **Limitations & Safety:** Runs are serialized sequentially to maintain safety guarantees on the manifest (~N× longer execution), shared stdio, and `SIGINT` signals exit the entire process. `loop-swarm` provides git worktree isolation rather than OS-level container isolation — see [docs/safety.md](./safety.md).

### Windows / CRLF notes

Windows contributors and loop operators should keep line-ending and process invocation differences in mind:

* **Git line endings:** Recommended repository config is `git config core.autocrlf input` (or `false` with LF line endings) so checkouts and commits maintain clean LF line breaks across platforms.
* **`loop-sync` frontmatter:** YAML frontmatter extraction in `STATE.md` and `LOOP.md` supports both LF and CRLF line endings ([#476](https://github.com/cobusgreyling/loop-engineering/pull/476)).
* **`loop-sandbox` shims:** Windows `.cmd` executable shims (`npx`, `tsc`, etc.) that fail with `ENOENT` are automatically retried via shell execution, so manual `--shell` is rarely needed ([`tools/loop-sandbox/README.md`](../tools/loop-sandbox/README.md)).

#### Troubleshooting

* **If `loop-sync` reports drift unexpectedly on Windows:** Check for CRLF line breaks in `STATE.md` / `LOOP.md`. `loop-sync` strips carriage returns, but converting files to LF (`git config core.autocrlf input`) ensures multi-line matches match cleanly.
* **If `loop-sandbox` fails with `ENOENT` spawning commands:** Ensure command binaries are in your PATH, or explicitly pass `--shell` if calling custom `.bat`/`.cmd` scripts.

## Copy-paste cheat sheet

```bash
# Scaffold — --tool accepts: grok | claude | codex | opencode
# (cursor, windsurf, openclaw: manual copy — see table in section 2)
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude

# List patterns and flags
npx @cobusgreyling/loop-init --help

# Cost check
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d

# Audit + suggestions
npx @cobusgreyling/loop-audit . --suggest

# Optional badge for your README
npx @cobusgreyling/loop-audit . --badge

# Check STATE.md ↔ LOOP.md drift (run after editing LOOP.md, before scheduling L2)
npx @cobusgreyling/loop-sync .

# Optional MCP runtime lookup (patterns, skills, state on demand)
LOOP_PROJECT_ROOT=. npx @cobusgreyling/loop-mcp-server

# L2: isolated worktree per fix attempt (PR Babysitter, CI Sweeper)
npx @cobusgreyling/loop-worktree create --run-id <id> --pattern <pattern>
npx @cobusgreyling/loop-worktree mark --run-id <id> --status rejected
npx @cobusgreyling/loop-worktree cleanup --older-than 24h

# Ephemeral worktree isolation + patch capture
npx @cobusgreyling/loop-sandbox run -- <command>
npx @cobusgreyling/loop-sandbox review

# Multi-agent consensus sandboxing across sequential sandboxes
npx @cobusgreyling/loop-swarm run --count 3 -- <agent-cmd>
```

## Learn the why (optional, 10 minutes)

- [Loop Engineering essay](https://cobusgreyling.substack.com/p/loop-engineering) — concept and primitives
- [Primitives matrix](./primitives-matrix.md) — Grok vs Claude vs Codex vs OpenClaw vs Opencode vs Cursor
- [Operating loops](./operating-loops.md) — when to kill a loop

---

*Questions? [GitHub Discussions](https://github.com/cobusgreyling/loop-engineering/discussions) · Share your setup via [Add Adopter](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml)*
