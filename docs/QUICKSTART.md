# Quickstart — 5 minutes to your first loop

> **Stop prompting. Design the loop. Get a score.**

Watch the score climb: [loop-audit-demo.gif](../assets/visuals/loop-audit-demo.gif) (10 → 70 → 100 in ~15s).

Landed from [X](https://x.com), the [showcase](https://cobusgreyling.github.io/loop-engineering/), or a friend's README? This is the shortest path from zero to a running loop.

**Week one rule:** report only. No auto-fix, no auto-merge. Read what the loop writes before you let it act.

## 1. Pick your pain (30 seconds)

Not sure which loop? Use the [interactive pattern picker](https://cobusgreyling.github.io/loop-engineering/#interactive) on the showcase — it recommends a pattern, scaffold command, first `/loop` line, and a token estimate.

Or start with **Daily Triage** if you just want to learn loop discipline with low risk.

## 2. Scaffold in your repo (60 seconds)

Run this in the root of any git project (no clone required):

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
```

Swap `--tool grok` for `claude`, `codex`, or `opencode` if needed. Swap `--pattern` for any pattern from [patterns/registry.yaml](../patterns/registry.yaml).

`loop-init` copies the starter kit, creates `STATE.md`, `LOOP.md`, `loop-budget.md`, and `loop-run-log.md`, then **prints your Loop Ready score** and first command.

## 3. Check cost before you schedule (30 seconds)

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d
```

Adjust `--pattern`, `--level` (L1 → L2 → L3), and `--cadence` to match what you plan to run. High-frequency loops (CI Sweeper at 5m) can burn tokens fast — slow the cadence or require early-exit triage first.

## 4. Audit readiness (30 seconds)

```bash
npx @cobusgreyling/loop-audit . --suggest
```

Scores 0–100 with concrete next steps. Re-run after each improvement. Paste a badge when you're proud of the score:

```bash
npx @cobusgreyling/loop-audit . --badge
```

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
| Week two | Add a verifier skill; try one assisted fix in a worktree (L2) |
| Before unattended (L3) | `loop-budget.md` + `loop-run-log.md` filled, human gates in `LOOP.md`, proven runs |
| Unsure which pattern | [pattern-picker.md](./pattern-picker.md) · [loop-design-checklist.md](./loop-design-checklist.md) |
| Something broke | [failure-modes.md](./failure-modes.md) · [stories/](../stories/) |

## Copy-paste cheat sheet

```bash
# Scaffold (swap --tool for claude | codex | opencode)
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok

# Cost check
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d

# Audit + suggestions
npx @cobusgreyling/loop-audit . --suggest

# Optional badge for your README
npx @cobusgreyling/loop-audit . --badge
```

## Learn the why (optional, 10 minutes)

- [Loop Engineering essay](https://cobusgreyling.substack.com/p/loop-engineering) — concept and primitives
- [Primitives matrix](./primitives-matrix.md) — Grok vs Claude vs Codex vs OpenClaw vs Opencode vs Cursor
- [Operating loops](./operating-loops.md) — when to kill a loop

---

*Questions? [GitHub Discussions](https://github.com/cobusgreyling/loop-engineering/discussions) · Share your setup via [Add Adopter](https://github.com/cobusgreyling/loop-engineering/issues/new?template=add-adopter.yml)*
