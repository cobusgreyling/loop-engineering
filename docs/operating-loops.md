# Operating Loops in Production

Running a loop is operations work. This doc covers cost, logging, metrics, and when to pause or kill.

## Token & Cost Budgeting

Estimate before scheduling:

```bash
npx @cobusgreyling/loop-cost --pattern <id> --cadence <interval> --level L1
npx @cobusgreyling/loop-init . --pattern <id>   # scaffolds loop-budget.md + loop-run-log.md + loop-budget skill
```

`loop-audit` scores cost observability and caps L3 until budget + run log + LOOP.md budget section exist. It also caps L3 until the guardrails are proven: `npx @cobusgreyling/loop-drill . --record` drills `gate.yaml`, and the committed `loop-drill.json` must match the current policy ([loop-audit: present is not proven](../tools/loop-audit/README.md#present-is-not-proven)).

Rough planning factors:

| Factor | Impact |
|--------|--------|
| Cadence | Linear multiplier (5m vs 1d = 288× runs/day) |
| Sub-agents per run | Each = full model + tool round-trips |
| Context size | Large repos + full CI logs = expensive triage |
| Verifier model | Stronger model on verifier = worth it for unattended |

### Example Estimates (order of magnitude)

Assume ~50k tokens per light triage run, ~200k per run with implementer + verifier:

| Loop | Cadence | Runs/day | Rough daily tokens |
|------|---------|----------|-------------------|
| Daily triage (report only) | 1d | 1 | ~50k |
| CI sweeper (light) | 15m | 96 | ~5M (if every run is full — **avoid**) |
| PR babysitter | 5m | 288 | High — use early exit |

**Best practice**: Triage pass is cheap; spawn sub-agents **only** when state says actionable. Empty watchlist → exit in <5k tokens.

### Budget Rules

```markdown
## Loop Budget — Project X
- Max tokens/day: 2M (adjust to your plan)
- On exceed: pause schedulers, notify human
- Max sub-agent spawns per run: 3
```

Encode in skill or scheduler prompt: "If no high-priority items, exit immediately."

## Logging Each Run

Minimum log entry (append to `loop-run-log.md` or structured JSON):

```json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "success"
}
```

Human-readable alternative in `STATE.md` footer:

```markdown
---
Run log: 2026-06-09 08:15 | 4 findings | 1 worktree opened | 0 escalations
```

## Metrics Dashboard (Template)

Track weekly in a spreadsheet or Notion:

| Metric | PR Babysitter | Daily Triage | CI Sweeper |
|--------|---------------|--------------|------------|
| Runs | | | |
| Actionable findings | | | |
| Auto-fixes proposed | | | |
| Human escalations | | | |
| False positives | | | |
| Mean time to human awareness | | | |
| Token spend (est.) | | | |

Pattern-specific success metrics are in each [pattern](../patterns/README.md).

## When to Slow Down

- Token budget >80% mid-week
- False positive rate >30% on triage
- Same item escalated 2+ times in 48h
- Major release week — pause auto-fix loops, report-only

## When to Pause

- Production incident in progress (loop may fight hotfix)
- Breaking schema migration underway
- Key human reviewer OOO + auto-merge was enabled (don't)

## When to Kill a Loop

- Consistent S2 failures from [failure-modes.md](./failure-modes.md)
- Cost > value for 2 consecutive weeks
- Team mutes all notifications
- Pattern replaced by event-driven alternative (e.g. CI Action only)

**Kill checklist**:
1. `scheduler_delete` / disable Automation / remove Action
2. Archive state file with `status: retired`
3. Post-mortem in `stories/` (optional but valuable)

## Upgrade Path

```
Report-only (L1) → 1–2 weeks stable triage
       ↓
Small auto-wins (L2) → verifier + worktree + max attempts
       ↓
Connectors (L2+) → PRs/tickets updated automatically
       ↓
Unattended (L3) → only with denylist, budget, metrics, human gates
```

Never skip L1 for a new pattern on a production repo.