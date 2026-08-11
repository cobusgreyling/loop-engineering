# LongHorizon-Harness

[LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) is an outer runtime for long-running GUI and CLI tasks. It keeps the native Claude Code or Codex agent loop, but separates each round into Manager, Executor, and Auditor roles. Only independently verified progress is carried into the next round.

## Where it fits

LongHorizon-Harness is useful when one goal needs many rounds, fresh executor contexts, and artifact-level verification. It is not a cron scheduler for recurring loops, and it is not a sandbox by itself.

| Loop engineering primitive | LongHorizon-Harness mapping |
|---|---|
| Automations / Scheduling | Not built in. Start one goal with `lh-harness run`, or trigger it from an external scheduler. Within the run, the Manager chooses one next step per round. |
| Worktrees | Not created automatically. Point the workspace at a disposable worktree when code changes need isolation. |
| Skills | The selected Claude Code or Codex backend keeps its native skills and execution loop. |
| Plugins & Connectors | Backend-native MCP configuration is supported; optional computer-use plugins add GUI control. |
| Sub-agents | Manager, fresh-context Executor, and independent Auditor provide a planner / maker / checker split. |
| Memory / State | Task state, events, audit reports, role trajectories, and the final report live under `.lh-harness/runs/<run-id>/`. Only verified progress advances the task. |

Failed or rejected work does not replace previously verified state; the Manager plans the next round from accepted evidence. This is closest to the maker/checker structure used by the L2 patterns in this repository. Unlike a pattern starter, it can carry one mixed desktop-and-terminal objective across many different subtasks.

## Minimal CLI run

Install one supported agent runtime (`codex` or `claude`) first, then:

```bash
uv tool install lh-harness
lh-harness doctor

cd /path/to/your/workspace
lh-harness init
lh-harness run \
  --task "Inspect the current directory and summarize its files." \
  --agent codex
```

Use `--agent claude_code` for Claude Code. GUI work also needs a separately installed computer-use plugin; CLI-only work does not.

For a longer goal, keep the task in a reviewable file:

```bash
lh-harness run --task @task.md --agent codex
```

## Safety boundary

The current runtime operates in a local workspace, so role separation is not filesystem isolation. Run code-changing tasks in a disposable worktree or sandbox, keep auto-merge disabled, and carry the [path denylist and required human gates](../../docs/safety.md) into the task and agent configuration.

Treat the Auditor as an evidence gate, not as authorization to make security, payment, infrastructure, or other high-risk changes without a human.

## When to choose something else

- Use the native scheduling examples in this repository for cheap recurring triage or fixed-cadence monitoring.
- Use `loop-sandbox` or another isolation layer when the task must not touch the main checkout.
- Start with an L1 report-only pattern when the success criteria are still ambiguous.

See the [LongHorizon-Harness README](https://github.com/AMAP-ML/LongHorizon-Harness#one-command-full-visibility) for configuration, Dashboard use, computer-use plugins, and benchmark reproduction.
