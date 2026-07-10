# PR Babysitter — Hermes Agent (`hermes cron`)

This is a practical, copy-pasteable example of a PR babysitter loop using Hermes.

Hermes ships a native scheduler on its **gateway** — map the loop to `hermes cron`
instead of a TUI `/loop`. Optional **channel delivery** (Feishu, Slack, Telegram,
Discord, WhatsApp, SMS) can ping blockers into the channel the team already watches
once you trust the output; week one stays on `--deliver local`.

## Cron job (week one — report only)

Isolated session each tick: reads GitHub state, updates `pr-babysitter-state.md`,
no code edits, **no merges**.

```bash
hermes cron create "*/15 * * * *" \
  --name "PR babysitter" \
  --deliver local \
  --skill pr-review-triage \
  --workdir "$PWD" \
  "Run the pr-review-triage skill on all open PRs. Read pr-babysitter-state.md first, then update it with current CI status, review state, merge conflicts, and unanswered comments. Do not merge or push fixes in week one — report only. Flag anything ambiguous or high-risk for human review in pr-babysitter-state.md. End with the top 3 human actions."
```

- `--deliver local` writes output to `~/.hermes/cron/output/` only — nothing lands
  in the human's chat history until you trust the output. Swap for `--deliver origin`
  (current chat), a home channel name (e.g. `slack`, `feishu`), or
  `platform:chat_id:thread_id` for a specific thread.
- `--workdir "$PWD"` injects `AGENTS.md` / `CLAUDE.md` / `.cursorrules` from the
  project into the system prompt and pins the terminal cwd to the repo.
- Repeat `--skill` to attach multiple skills (e.g. `--skill pr-review-triage
  --skill github-workflow` if PR reads go through a GitHub skill instead of `gh`).
- Operations: `hermes cron run <job-id>` for a one-off test tick, then
  `pause` / `resume` / `edit` / `remove` as needed.

## Progression

- **Week one — report only.** Fresh isolated session each tick appends to
  `pr-babysitter-state.md`. Read it yourself before acting on any suggestion.
  Human gates all merges.
- **Week two — minimal fixes in worktrees.** Extend the prompt to propose fixes
  in an isolated worktree for allowlisted low-risk PRs only — one worktree per
  fix attempt via [`loop-worktree`](../../docs/QUICKSTART.md#l2-isolated-fix-attempts-loop-worktree)
  so retries never collide on the same branch. Draft PRs only; never force-push.
- **Week two — verifier split.** A separate verifier approves before any fix is
  committed: a second `delegate_task` call with a review-only prompt, or a chained
  cron job via `hermes cron edit <fixer-id> --context-from <triage-id>` (the
  upstream job's stdout is injected into the downstream prompt). Never let the
  implementer mark its own work done. Escalate after 3 attempts per PR.
- **Add channel delivery.** Swap `--deliver local` for a home channel once the
  output has earned trust; set channel `allowFrom` / mention rules first.

Week-two worktree lifecycle (see the
[loop-worktree subsection of the QUICKSTART](../../docs/QUICKSTART.md#l2-isolated-fix-attempts-loop-worktree)):

```bash
npx @cobusgreyling/loop-worktree create --run-id pr-217-fix-1 --pattern pr-babysitter
# fix + verifier run inside the printed worktree path
npx @cobusgreyling/loop-worktree mark --run-id pr-217-fix-1 --status rejected   # verifier said no
npx @cobusgreyling/loop-worktree cleanup --older-than 24h
```

## Requirements

- [Hermes Agent](https://hermes-agent.nousresearch.com/docs) installed and
  configured (`hermes setup`)
- `pr-babysitter-state.md` in the repo root (from `starters/pr-babysitter/`)
- The `pr-review-triage` skill in `~/.hermes/skills/pr-review-triage/SKILL.md`
  (user-scoped) or `.hermes/skills/` (project-scoped) — the `SKILL.md` format is
  shared across tools, so the starter copy works unchanged

```bash
cp starters/pr-babysitter/pr-babysitter-state.md.example pr-babysitter-state.md

mkdir -p ~/.hermes/skills/pr-review-triage
cp starters/pr-babysitter/.claude/skills/pr-review-triage/SKILL.md ~/.hermes/skills/pr-review-triage/SKILL.md

hermes skills list | grep pr-review-triage
```

## Example pr-babysitter-state.md

```markdown
# PR Babysitter State
Last run: 2026-07-05 09:00 UTC

## Open PRs

### #1234 — fix: correct login redirect
- CI: green
- Reviews: 1 approval, 1 blocking comment
- Loop action: report only (week one). Needs human triage.
- Attempts: 1 / 3
```

## Notes

- Never force-push; draft PRs by default; do not resolve review threads without
  approval. Security, auth, payments, infra, or public API changes always
  escalate — see [docs/safety.md](../../docs/safety.md)
- Sign loop comments on PRs: `🤖 Loop Engineering — PR Babysitter`
- Webhooks (`POST /hooks/agent`) can fire a check the moment CI finishes instead
  of waiting for the next tick — keep hook endpoints on loopback or a trusted tailnet
- `hermes config set approvals.mode smart` so low-risk reads don't stall the loop
  on manual gateway approvals
- Most runs should no-op on an empty watchlist. Cost check:
  `npx @cobusgreyling/loop-cost --pattern pr-babysitter --cadence 15m --level L1 --conservative`;
  audit readiness: `npx @cobusgreyling/loop-audit . --suggest`
- See [patterns/pr-babysitter.md](../../patterns/pr-babysitter.md) and
  [starters/pr-babysitter](../../starters/pr-babysitter/) for the full pattern spec

See the [primitives matrix](../../docs/primitives-matrix.md) for how Hermes maps
to the same six-part loop shape.
