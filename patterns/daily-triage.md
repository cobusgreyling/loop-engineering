# Daily Triage Loop

**Goal**: Start each day (or active period) with a prioritized, actionable picture of what needs attention — without manually checking CI, issues, PRs, and chat.

## Scheduling

**Recommended**:
- `/loop 1d` for morning triage (Grok, Claude Code)
- `/loop 2h` during active sprints for faster signal
- GitHub Action cron `0 8 * * 1-5` for teams without a TUI

Many teams run triage-only first (reporting, no auto-fix) for 1–2 weeks before enabling action.

## Required Skills

- `loop-triage` — Reads CI, issues, commits, chat; produces prioritized findings (see `templates/SKILL.md.loop-triage`)
- `minimal-fix` (optional, phase 2) — Drafts small fixes for obvious failures
- Reviewer sub-agent or skill (optional, phase 2) — Verifies proposed fixes

## State

Use `STATE.md` (or a Linear board view) as the memory spine:

```markdown
# Loop State — Project X

Last run: 2026-06-09 08:15 UTC

## High Priority (loop is acting or waiting on human)
- [ ] #1241 — flaky test in auth flow (CI red on main)
  Loop action: Opened worktree. Fix proposed. Waiting for human PR review.

## Watch List
- PR #1238 open 4 days with no activity.

## Recent Noise (ignored this run)
- Dependabot PRs (separate automation)
```

Fields the loop must update every run:
- `Last run` timestamp
- Item status + last action taken
- Human decisions that overrode the loop

## How the Loop Runs (Typical Cycle)

1. Scheduler fires (morning or interval).
2. Triage skill ingests: CI failures (24h), open issues/tickets, recent commits, prior `STATE.md`.
3. High-priority items appended to state with suggested next action.
4. (Phase 2) For small, self-contained failures: open worktree → implementer → verifier.
5. (Phase 3) Connectors update PRs/tickets; ambiguous items flagged for human.
6. Prune resolved/merged items from state.
7. Record post-run critique in state: false positives, repeated items, re-prioritized or dropped items, and one adjustment for next run.

## Post-Run Critique

After each Daily Triage run, record:

- High-noise items.
- False positives (items incorrectly flagged).
- Items that should be deprioritized.
- Any human-review friction.
- One change to improve the next cycle.

## Verification Strategy

- Phase 1 (report-only): Human reads `STATE.md` — no auto-action verification needed.
- Phase 2+: Never let implementer mark work done; verifier confirms fix scope and tests.
- Triage skill must not invent architectural work — signal only.

## Human Handoff Points

- Design decisions or multi-file refactors
- Security, auth, payments, infrastructure
- Items flagged "needs discussion" in triage output
- Anything the loop has surfaced 3+ days without resolution

## Tool-Specific Notes

**Grok Build TUI**:
```bash
/loop 1d Run the loop-triage skill. Append high-priority items to STATE.md. For obvious small bugfixes only: worktree + minimal-fix + verifier sub-agent (maker/checker). Flag ambiguous items for human review.
```

**Claude Code**:
```bash
/loop 1d Run $loop-triage and update STATE.md. Do not auto-fix on first week — report only.
```

**Codex**:
- Automations tab: daily prompt calling `$loop-triage`, output to Triage inbox + `STATE.md`.

**GitHub Actions**:
- See `examples/github-actions/daily-triage.yml`.

## Failure Modes & Mitigations

| Failure | Mitigation |
|---------|------------|
| Triage creates noise | Tighten skill rules; add "Noise / Ignore" section |
| State file grows unbounded | Prune merged/closed items every run |
| Auto-fix on wrong priority | Start report-only; add explicit effort/risk gates |
| Missed overnight failures | Add `fireImmediately: true` or run at start of day + mid-day |
| Stale critique / never reviewed | Add human handoff when critique entries accumulate without resolution across N runs. |

## Cost Profile

| Scenario | Tokens/run | Notes |
|----------|------------|-------|
| No-op | ~5k | Nothing actionable in state |
| Full triage (L1) | ~50k | CI + issues + commits scan |
| Assisted fix (L2) | ~200k | Worktree + implementer + verifier |

**Cadence**: 1d–2h · **Tier**: low · **Suggested daily cap**: 100k tokens

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --cadence 1d --level L1
```

Scaffold `loop-budget.md` and `loop-run-log.md` with `loop-init`. See [operating-loops.md](../docs/operating-loops.md).

## Success Metrics

- Time from "something broke" to "human knows about it"
- % of mornings where `STATE.md` matched what you'd have found manually
- Reduction in ad-hoc "what's on fire?" Slack messages

Start report-only. Add action only when triage quality is consistently good.