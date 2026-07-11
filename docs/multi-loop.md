# Multi-Loop Coordination

Running more than one loop in a repo is normal. Running them without boundaries is how loops fight each other.

## Principles

1. **One owner per branch** — at most one loop may mutate a branch per hour.
2. **Separate state files** — `STATE.md` for triage; pattern-specific files for action loops.
3. **Triage reports, action loops execute** — Daily Triage at L1 never competes with CI Sweeper fixes.
4. **Shared denylist** — copy the same path denylist into every LOOP.md.
5. **Aggregate token budget** — see `templates/loop-budget.md.template`.

## Recommended state layout

```
STATE.md                    # Daily Triage (priorities, human inbox)
pr-babysitter-state.md      # PR watcher
ci-sweeper-state.md         # Active CI failures + attempt counts
dependency-sweeper-state.md # In-flight package updates
post-merge-state.md         # Cleanup backlog
loop-run-log.md             # Append-only observability
```

## Priority when loops conflict

| Priority | Loop | Reason |
|----------|------|--------|
| 1 | CI Sweeper | Red main blocks everything |
| 2 | PR Babysitter | Active PRs are time-sensitive |
| 3 | Dependency Sweeper | Pause while CI red |
| 4 | Post-Merge Cleanup | Off-peak, lowest urgency |
| 5 | Daily Triage | Reports only at L1; schedules others |

## Scheduler coordination

Document in root `LOOP.md`:

```markdown
## Multi-loop schedule
- CI Sweeper: /loop 15m (active hours)
- PR Babysitter: /loop 10m (active hours, skip if CI Sweeper acting on same PR)
- Daily Triage: /loop 1d 08:00
- Dependency Sweeper: /loop 6h (skip if main CI red)
- Post-Merge: /loop 1d 22:00
```

## Collision detection

Each action loop should write `acting_on: branch-or-pr-id` in its state file. Before spawning a fix:

1. Read all other pattern state files
2. If another loop `acting_on` matches → skip and log to `loop-run-log.md`

## Human inbox

Use a shared section in `STATE.md`:

```markdown
## Human Inbox (ambiguous / cross-loop)
- [ ] PR #42: CI Sweeper and PR Babysitter both flagged — human pick owner
```

## Example: safe three-loop setup

| Loop | Level | Cadence |
|------|-------|---------|
| Daily Triage | L1 | 1d |
| PR Babysitter | L2 | 10m |
| Post-Merge Cleanup | L1 → L2 | 1d off-peak |

Add CI Sweeper only after PR Babysitter attempt limits and verifier are proven for two weeks.

See [stories/multi-loop-collision.md](../stories/multi-loop-collision.md) and [stories/dependency-vs-ci-sweeper-collision.md](../stories/dependency-vs-ci-sweeper-collision.md) for real-world collision stories.