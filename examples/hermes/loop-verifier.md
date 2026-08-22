# Loop Verifier — Hermes Agent (`delegate_task`)

The verifier is the maker/checker half of any L2 Hermes loop. Claude Code ships it as
[`.claude/agents/loop-verifier.md`](../../starters/pr-babysitter/.claude/agents/loop-verifier.md)
and Codex as
[`.codex/agents/verifier.toml`](../../starters/ci-sweeper/.codex/agents/verifier.toml);
Hermes has no agent file format, so the verifier lives as a **skill** plus a
**delegate call**. This page shows how to wire the repo's tool-agnostic
[`loop-verifier` skill](../../skills/loop-verifier/SKILL.md) into a Hermes cron
loop as an independent, test-running reviewer.

The one rule that makes a verifier a verifier: **it must not live in the same run
as the implementer.** In Hermes that means a `delegate_task` call with a
review-only prompt and its own isolated session — never prompting the main agent
to "review itself".

## Setup

```bash
# User-scoped skill — available to every Hermes session
mkdir -p ~/.hermes/skills/loop-verifier
cp templates/SKILL.md.verifier ~/.hermes/skills/loop-verifier/SKILL.md

hermes skills list | grep loop-verifier
```

For a project-scoped verifier, put it in `.hermes/skills/loop-verifier/` instead.

## Week two — wiring the verifier into a loop

Start with the L1 report loop from
[`daily-triage.md`](./daily-triage.md). In week two, the same cron job proposes a
fix but never applies it. The verifier runs as a separate `delegate_task` call.

An L2 fixer cron job that hands off to the verifier:

```bash
hermes cron create "0 7 * * 1-5" \
  --name "Triage → apply + verify" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Read the injected triage output. If it contains a fenced patch: create an isolated git worktree, apply the patch, run the project's test command, then delegate a verifier subagent to review the diff. Escalate ambiguous or denylisted paths. Update STATE.md with the outcome."
```

The verifier call itself — **review-only**, its own session, no fix tools:

```
delegate_task(
  role="leaf",
  goal="Run the loop-verifier skill on the change in the current worktree. " \
       "Return APPROVE, REJECT, or ESCALATE_HUMAN with evidence.",
  context="Fixing regression from STATE.md item #1241. Implementer proposes ...",
  toolsets=["terminal", "read"]
)
```

Split implementer and verifier across **two** cron jobs chained with `--context-from` (the upstream job's stdout is injected into the downstream prompt) when you need the verifier fully independent:

```bash
# 1. Implementer job proposes the fix
IMPLEMENTER_ID=$(hermes cron create "5 7 * * 1-5" \
  --name "daily-fix-propose" \
  --deliver local \
  --skill loop-triage \
  --workdir "$PWD" \
  "Run the loop-triage skill. For high-priority single-file bugfixes propose a minimal diff in a fenced patch block. Update STATE.md. Do not apply." \
  | tail -1)

# 2. Verifier job reviews the proposal
VERIFIER_ID=$(hermes cron create "10 7 * * 1-5" \
  --name "daily-fix-verify" \
  --deliver local \
  --skill loop-verifier \
  --workdir "$PWD" \
  "Read the injected proposal. Review it against STATE.md using the loop-verifier skill: scope, intent, tests, no-cheating, risk. Update STATE.md with the verdict." \
  | tail -1)

hermes cron edit "$VERIFIER_ID" --context-from "$IMPLEMENTER_ID"
```

## Verification split

| Role | Hermes shape |
|------|--------------|
| Triage | `loop-triage` skill + `hermes cron --deliver local` (see L1) |
| Implementer | Main cron run (L2) or a leaf `delegate_task` in a git worktree |
| Verifier | Second `delegate_task`, or a chained cron job via `--context-from` |

Keep the verifier's tool allowance minimal: `terminal` (to run tests) and `file` (to read the diff) are enough for most review loops. Do not hand it write access to GH, MCP connectors, or code paths unless the loop is trusted.

## Safety (L1 → L2)

- Week one stays report-only; the verifier adds no run authority of its own.
- The verifier's default stance is **REJECT** until tests run and scope is checked — the skill encodes this.
- Do not trust the implementer's "tests pass" claim; the verifier must run them.
- Escalate ambiguous, auth, payments, security, public-API changes to a human — see [docs/safety.md](../../docs/safety.md).
- Cost and attempt caps: a new verifier `delegate_task` is a fresh agent session per review — count it in [`loop-budget.md`](../../loop-budget.md).

## Operations

```bash
hermes cron list
hermes cron status
hermes cron run <job-id>           # one-off test tick
hermes cron edit "$VERIFIER_ID" --context-from "$IMPLEMENTER_ID"
hermes cron pause <job-id>
```

Audit the loop: `npx @cobusgreyling/loop-audit . --suggest`

## References

- [Loop Verifier skill](../../skills/loop-verifier/SKILL.md) — the shared spec
- [Hermes Daily Triage](./daily-triage.md) — L1 base this wires into
- [Hermes PR Babysitter](./pr-babysitter.md) — L2 progression with worktrees
- [docs/safety.md](../../docs/safety.md) — human gates
