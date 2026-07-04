# Daily Triage — Hermes Agent

Same pattern as Grok, Claude Code, and OpenClaw; scheduling runs on the Hermes **gateway** (`hermes cron`) instead of a TUI `/loop`. Hermes ships the six loop primitives (**cronjob / skill / STATE / delegate_task / MCP / memory**) in one binary, so a full L1 daily-triage loop needs no extra runtime — just a scheduled job + a skill + a state file.

Optional **channel delivery** (Feishu, Slack, Telegram, Discord, WhatsApp, SMS) is the main reason to run triage here — the same cron job can post its summary into any connected home channel.

## Prerequisites

1. [Hermes Agent](https://hermes-agent.nousresearch.com/docs) installed and configured (`hermes setup`).
2. `STATE.md` at the repo root — copy from `starters/minimal-loop/STATE.md.example`.
3. `loop-triage` skill — copy `templates/SKILL.md.loop-triage` into `~/.hermes/skills/loop-triage/SKILL.md` (or the workspace-local `.hermes/skills/` directory for project-scoped skills).

```bash
# Project-scoped state
cp starters/minimal-loop/STATE.md.example STATE.md

# User-scoped skill (available to every Hermes session)
mkdir -p ~/.hermes/skills/loop-triage
cp templates/SKILL.md.loop-triage ~/.hermes/skills/loop-triage/SKILL.md
```

Verify:

```bash
hermes skills list | grep loop-triage
```

## Report-Only (Week 1)

Isolated cron job: fresh session each run, writes to `STATE.md`, no code edits. Delivery pinned to `local` so nothing leaks into the human's DM history until you trust the output.

```bash
hermes cron create "0 7 * * 1-5" \
  --name "Daily triage" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Run the loop-triage skill. Read STATE.md. Merge findings into High Priority and Watch List. Update Last run timestamp. Do not edit source code. End with a 5-line summary."
```

- `--workdir "$PWD"` injects `AGENTS.md` / `CLAUDE.md` / `.cursorrules` from the project into the system prompt and pins the terminal cwd to the repo — cross-project isolation without a `git worktree` per run.
- `--deliver local` writes output to `~/.hermes/cron/output/` only. Swap for `--deliver origin` (current chat), a home channel name (e.g. `feishu`, `slack`), or `platform:chat_id:thread_id` for a specific thread.
- Repeat `--skill` to attach multiple skills (e.g. `--skill loop-triage --skill github-workflow` if the loop reads PRs).

Faster cadence during active periods:

```bash
hermes cron create "0 */2 * * *" \
  --name "Triage pulse" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Run loop-triage. Report obvious small wins only. Update STATE.md. No code changes."
```

Announce the summary into a Feishu chat instead of keeping it local:

```bash
hermes cron create "0 9 * * 1-5" \
  --name "Daily triage → Feishu" \
  --deliver feishu \
  --skill loop-triage \
  --workdir "$PWD" \
  "Run loop-triage. Post a 5-line summary of STATE.md changes to the home channel. No code edits."
```

## With Small Auto-Fixes (Week 3+)

Add a **verifier sub-agent** via Hermes's `delegate_task` tool inside the skill, or split the loop into two cron jobs chained with `--context-from` (upstream job's stdout is injected into the downstream job's prompt).

```bash
# 1. Triage job produces STATE.md diff + a bounded fix proposal
TRIAGE_ID=$(hermes cron create "0 7 * * 1-5" \
  --name "Triage + propose" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Run loop-triage. For high-priority single-file bugfixes, propose a minimal diff in a fenced patch block. Update STATE.md. Do not apply the patch." \
  | tail -1)

# 2. Fixer job reads the triage output, applies the patch in an isolated worktree,
#    runs tests, and has a verifier pass review the diff before commit.
hermes cron create "5 7 * * 1-5" \
  --name "Triage → apply + verify" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Read the injected triage output. If it contains a fenced patch: create an isolated git worktree, apply the patch, run tests, then delegate a verifier subagent to review the diff. Escalate ambiguous or denylisted paths. Update STATE.md with the outcome."
```

Chain the two jobs with:

```bash
hermes cron edit <fixer-job-id> --context-from "$TRIAGE_ID"
```

The fixer's prompt is prefixed with the triage job's most recent completed output on every tick — Hermes's built-in inter-job pipeline.

## Event-Triggered Triage

Webhook instead of cron — useful after deploys, CI failures, or GitHub Actions notifications:

```bash
curl -X POST http://127.0.0.1:8765/hooks/agent \
  -H "Authorization: Bearer $HERMES_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Run loop-triage on recent CI failures. Update STATE.md. Report only.",
    "name": "CI triage",
    "deliver": "local"
  }'
```

Keep hook endpoints on loopback or a trusted tailnet. See [Hermes webhooks](https://hermes-agent.nousresearch.com/docs) and the [`webhook-subscriptions`](https://github.com/nousresearch/hermes/blob/main/skills/devops/webhook-subscriptions/SKILL.md) skill.

## Verification Split

| Role | Hermes shape |
|------|--------------|
| Triage | `loop-triage` skill + `hermes cron` with `--deliver local` |
| Implementer | Main agent or `delegate_task(role='leaf', toolsets=['terminal','file'])` in a `git worktree` |
| Verifier | Second `delegate_task` call with a review-only prompt, or a chained cron job |

Hermes cron runs prefer the **agent's final message** as delivered output — structure verifier work as explicit sub-steps in the prompt or delegate them so intermediate tool output stays out of the summary.

## Safety (L1 defaults)

- `--deliver local` — do not pollute human chat history with routine triage turns until you trust the output.
- Restrict which toolsets the sub-agents can call: pass `enabled_toolsets` on `delegate_task`, or keep the skill's tool list minimal.
- Home-channel `allowFrom` / mention rules should be set before switching `--deliver` away from `local`.
- Week one: **report-only**; human reads `STATE.md` and the local output before enabling channel delivery.
- Approvals: set `hermes config set approvals.mode smart` so low-risk commands don't stall the loop on manual gateway approvals.

## Operations

```bash
hermes cron list
hermes cron status
hermes cron run <job-id>       # fire on next scheduler tick, one-off
hermes cron pause <job-id>
hermes cron resume <job-id>
hermes cron edit <job-id> --prompt "..."
hermes cron remove <job-id>
```

Pause without deleting: `hermes cron pause <job-id>`. Or set `loop-pause-all` inside `STATE.md` and teach the skill to short-circuit when it sees that flag — the loop keeps ticking but produces no side effects, which preserves scheduler history for audit.

Audit readiness: `npx @cobusgreyling/loop-audit . --suggest`

## References

- Peter Steinberger — design loops, not one-off prompts ([sources](../../resources/sources.md))
- [primitives-matrix.md](../../docs/primitives-matrix.md) — Hermes column
- [patterns/daily-triage.md](../../patterns/daily-triage.md)
- [docs/safety.md](../../docs/safety.md)
- [Hermes docs](https://hermes-agent.nousresearch.com/docs)
