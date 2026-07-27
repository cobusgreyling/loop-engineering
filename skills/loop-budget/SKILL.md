---
name: loop-budget
description: Check token budget and run-log spend before and after a loop run. Enforces early exit when over budget or when there is no actionable work.
---

# Loop Budget Guard

Run at the **start** and **end** of every loop iteration.

## Start of run

1. Read `loop-budget.md` for daily caps and kill-switch flags.
2. Read recent entries in `loop-run-log.md` (last 24h).
3. Sum `tokens_estimate` for the active pattern today.
4. If spend ≥ 80% of the pattern's daily cap → **report-only mode** (no sub-agents, no auto-fix).
5. If spend ≥ 90% and High Priority items remain in `STATE.md`, yield to the [budget-negotiator](../budget-negotiator/SKILL.md) skill (if installed). Otherwise, if spend ≥ 100% or `loop-pause-all` is set → **exit immediately** with a one-line note in STATE.md.
6. If watchlist/state has no actionable items → **exit in <5k tokens** (do not spawn sub-agents).

## End of run

Append one JSON object to `loop-run-log.md`:

```json
{
  "run_id": "<ISO8601>",
  "pattern": "<pattern-id>",
  "duration_s": <number>,
  "items_found": <number>,
  "actions_taken": <number>,
  "escalations": <number>,
  "tokens_estimate": <number>,
  "outcome": "no-op | report-only | fix-proposed | escalated"
}
```

## Rules

- Never exceed `max sub-agent spawns/run` from `loop-budget.md`.
- High-cadence patterns (CI Sweeper, PR Babysitter) **must** early-exit when nothing is actionable.
- On self-throttle, append a line to `loop-budget.md` under **Alerts This Period**.