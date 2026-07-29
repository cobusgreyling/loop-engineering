# Quickstart — 5 minutes to your first loop

> **Stop prompting. Design the loop. Get a score.**

Watch the score climb: [loop-audit-demo.gif](../assets/visuals/loop-audit-demo.gif) (10 → 70 → 100 in ~15s).

Landed from [X](https://x.com), the [showcase](https://cobusgreyling.github.io/loop-engineering/), or a friend's README? This is the shortest path from zero to a running loop.

**Week one rule:** report only. No auto-fix, no auto-merge. Read what the loop writes before you let it act.

**Front door:** prefer the unified CLI (`@cobusgreyling/loop`). Dedicated packages (`loop-init`, `loop-audit`, …) stay fully supported — see [cli-front-door.md](./cli-front-door.md).

## 1. Pick your pain (30 seconds)

Not sure which loop? Use the [interactive pattern picker](https://cobusgreyling.github.io/loop-engineering/#interactive) on the showcase — it recommends a pattern, scaffold command, first `/loop` line, and a token estimate.

Or start with **Daily Triage** if you just want to learn loop discipline with low risk.

## 2. Scaffold in your repo (60 seconds)

Run this in the root of any git project (no clone required):

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool grok
# One health check (audit + sync + top 3 actions):
npx @cobusgreyling/loop doctor .
# Optional one-command funnel into harness-foundry:
npx @cobusgreyling/loop init . --pattern daily-triage --tool grok --with-foundry
```

Equivalent (old door, still supported):

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
```

Swap `--pattern` for any pattern from [patterns/registry.yaml](../patterns/registry.yaml). List all patterns:

```bash
npx @cobusgreyling/loop init --help
```

### Which `--tool` values work?

| `--tool` value | Scaffolded by `loop-init`? | Notes |
|----------------|---------------------------|-------|
| `grok` | Yes (default) | Native `/loop` scheduling |
| `claude` | Yes | Native `/loop` + `$skill` invocation |
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

## Copy-paste cheat sheet

```bash
# Scaffold — --tool accepts: grok | claude | codex | opencode
# (cursor, windsurf, openclaw: manual copy — see table in section 2)
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok

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
```

## Learn the why (optional, 10 minutes)

- [Loop Engineering essay](https://cobusgreyling.substack.com/p/loop-engineering) — concept and primitives
- [Primitives matrix](./primitives-matrix.md) — Grok vs Claude vs Codex vs OpenClaw vs Opencode vs Cursor
- [Operating loops](./operating-loops.md) — when to kill a loop

---

*Questions? [GitHub Discussions](https://github.com/cobusgreyling/loop-engineering/discussions) · Share your setup via [Add Adopter](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml)*
