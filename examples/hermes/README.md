# Hermes Agent

[Hermes Agent](https://hermes-agent.nousresearch.com/docs) ships the six loop primitives (cronjob / skill / STATE / delegate_task / MCP / memory) in one binary — no extra runtime needed for a full L1 daily-triage loop.

| Example | Pattern |
|---------|---------|
| [daily-triage.md](./daily-triage.md) | Daily Triage (L1 report → L2 assisted) |
| [pr-babysitter.md](./pr-babysitter.md) | PR Babysitter (L1 report → L2 worktree + verifier) |
| [ci-sweeper.md](./ci-sweeper.md) | CI Sweeper (L1 report → L2 worktree + verifier) |
| [issue-triage.md](./issue-triage.md) | Issue Triage (L1 propose-only → L2 allowlisted labels) |
| [loop-verifier.md](./loop-verifier.md) | Loop Verifier (L2 — independent maker/checker split via `delegate_task`) |

Optional **channel delivery** (Telegram, Slack, Discord, WhatsApp, SMS, Feishu) is Hermes's differentiator — the same cron job can post its summary into any connected home channel.

No `loop-init --tool hermes` yet — copy skills and state manually, then schedule via `hermes cron`.

See [docs/primitives-matrix.md](../../docs/primitives-matrix.md) for the Hermes column in the cross-tool matrix.
