# CI Sweeper — Hermes Agent (`hermes cron`)

This example maps the [CI Sweeper pattern](../../patterns/ci-sweeper.md) to
Hermes's native scheduler. Week one is deliberately **report-only**: each run
classifies failing checks, updates a state file, and exits without changing code
or GitHub state.

Keep delivery local while you tune the loop. After its reports are consistently
useful, the same cron job can deliver summaries to a connected channel.

## Setup

Copy the shared state and `ci-triage` skill, then confirm Hermes can discover the
skill:

```bash
cp starters/ci-sweeper/ci-sweeper-state.md.example ci-sweeper-state.md

mkdir -p ~/.hermes/skills/ci-triage
cp starters/ci-sweeper/.claude/skills/ci-triage/SKILL.md \
  ~/.hermes/skills/ci-triage/SKILL.md

hermes skills list | grep ci-triage
```

The skill format is shared across tools. Use `.hermes/skills/ci-triage/` instead
when the skill should be available only inside this project.

## Week one — report only

Start with a 15-minute cadence on active repositories. The prompt has an early
exit so green CI remains a cheap no-op.

```bash
hermes cron create "*/15 * * * *" \
  --name "CI sweeper" \
  --deliver local \
  --skill ci-triage \
  --workdir "$PWD" \
  "Run the ci-triage skill. Read ci-sweeper-state.md, then inspect the latest CI checks on the default branch and active PRs. If every watched check is green, update Last run and stop. For each failure, record the check URL, job or test, first failing commit SHA, classification (regression, flake, infrastructure, config, or unknown), confidence, evidence, proposed human action, and attempt count. Move entries between Active Failures, Watch, and Resolved (last 7d). Week one is report-only: do not edit source or workflow files; do not create a worktree, branch, commit, or PR; do not retry CI; do not post GitHub comments or change checks; do not merge or enable auto-merge. Escalate ambiguous, security, release, secret, permission, and infrastructure failures. End with the top three human actions."
```

- `--workdir "$PWD"` pins the repository and injects its `AGENTS.md`,
  `CLAUDE.md`, or `.cursorrules` into the fresh cron session.
- `--deliver local` writes to `~/.hermes/cron/output/`; it does not add routine
  reports to a human chat.
- `--skill ci-triage` attaches the shared classifier without granting a fixer
  permission to act.

Run one tick manually before relying on the schedule:

```bash
hermes cron list
hermes cron run <job-id>
hermes cron status
```

Pause the job while changing its scope: `hermes cron pause <job-id>`. Resume only
after reviewing the prompt and the latest state file.

## State file

Keep enough evidence to distinguish a new regression from a known flake or
infrastructure incident:

```markdown
# CI Sweeper State

Last run: 2026-08-10 09:30 UTC
Mode: report-only

## Active Failures

### main @ abc1234 — unit-tests / parses empty input
- Check: https://github.com/example/project/actions/runs/123
- Classification: regression (medium confidence)
- Evidence: first fails at abc1234; reproduced twice without a retry
- Proposed action: human confirms scope and validation command
- Attempts: 0 / 3

## Watch (flakes / infra)

### release/2.x @ def5678 — integration / registry login
- Classification: infrastructure (high confidence)
- Evidence: registry returned 503 across unrelated jobs
- Proposed action: escalate; no retry or code change

## Resolved (last 7d)

- main @ 789abcd — lint failure fixed by PR #456
```

Do not put credentials or unredacted secrets from CI logs into this file.

## Optional channel delivery

Keep `local` as the trust-building default. Once reports have been reviewed over
several runs, edit the job to use `--deliver origin`, a configured home channel
such as `slack` or `feishu`, or a specific `platform:chat_id:thread_id` target.
Set the channel's `allowFrom` and mention rules first; delivery changes where the
summary appears, not what the loop is allowed to do.

A CI webhook can replace polling when your Hermes gateway is already configured
for trusted event delivery. Keep the same report-only prompt and the same state
transition rules.

## Week two — isolated fixes with an independent verifier

Enable fixes only after a human approves the exact failing check, allowed paths,
and validation command. Each attempt follows this boundary:

1. Create an isolated attempt with
   `npx @cobusgreyling/loop-worktree create --run-id <run-id> --pattern ci-sweeper`.
2. Run `minimal-fix` inside the printed worktree; never edit the primary checkout.
3. Run the approved test command in that worktree.
4. Ask a separate verifier to review the diff and test output, either with a
   review-only `delegate_task` call or a chained Hermes cron job using
   `--context-from`.
5. Present an approved patch or draft PR to a human. Never merge or enable
   auto-merge from the loop.
6. After three attempts on the same root cause, stop and escalate with the state
   history instead of retrying again.

The verifier must be independent of the implementer and must reject unrelated
changes, denylisted paths, or a fix that only hides the symptom. Security,
authentication, payments, secrets, permissions, release, and infrastructure
failures always remain human-owned.

## References

- [CI Sweeper pattern](../../patterns/ci-sweeper.md)
- [CI Sweeper starter](../../starters/ci-sweeper/)
- [`loop-worktree`](../../tools/loop-worktree/)
- [Safety and human gates](../../docs/safety.md)
- [Primitives matrix](../../docs/primitives-matrix.md)
