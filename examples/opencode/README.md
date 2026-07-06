# Opencode

Open-source coding agent that runs from the CLI, can run headlessly via `opencode run`, supports named agents, and can connect to tools through MCP. Loop engineering primitives publish to plain files: `AGENTS.md`, `STATE.md`, and `skills/` folders in the [AgentSkills](https://agentskills.io) format.

| Example | Pattern |
|---------|---------|
| [daily-triage.md](./daily-triage.md) | Daily Triage (L1 report → L2 assisted) |
| [constraints.md](./constraints.md) | Constraints (binding rules loaded before every loop run) |
| [ci-sweeper.md](./ci-sweeper.md) | CI Sweeper (cron/systemd + `opencode run` for short cadences) |
| [pr-babysitter.md](./pr-babysitter.md) | PR Babysitter (long-running PR shepherd with worktree isolation) |
| [Constraints Example](constraints-example.md) – Minimal loop-triage skill with recommended guardrails. |

> **Starter kit:** [../../starters/minimal-loop-opencode/](../../starters/minimal-loop-opencode/) — clone-and-run scaffold for L1 daily triage.
>
> No `loop-init --tool opencode` yet; copy the starter or follow the snippets below in 30 seconds.

See [docs/primitives-matrix.md](../../docs/primitives-matrix.md) for the full capability comparison.
