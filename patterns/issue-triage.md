# Issue Triage Loop

**Goal**: Continuously discover, deduplicate, prioritize, and label incoming issues, feature requests, and discussions so the team (and other loops) always have a clean, actionable top-of-queue. Pure report / proposal mode in week one. Extremely low risk, high leverage.

## Scheduling

**Recommended**:
- `/loop 2h` or `1d` (morning + end of day for busy repos)
- GitHub Action on `issues` / `discussion` events + scheduled fallback
- Pairs beautifully with Daily Triage (this loop feeds the "what should I work on" report)

This is an excellent always-on, low-cost companion loop.

## Required Skills

- `issue-triage` — Scans open issues, discussions, and (optionally via MCP) Linear / Jira. Dedupes, extracts signals (labels, comments, linked PRs, age, reactions), proposes priority + suggested labels + one-sentence summary.
- `loop-verifier` (light or human) — Sanity check on the proposed triage actions / new labels before anything is applied.

## State

Filename: `issue-triage-state.md`

Compact rolling view of the current backlog health:

```markdown
# Issue Triage State
Last run: 2026-06-09 09:15 UTC
Open actionable: 14 (was 17)
New since last run: 3
Needs human: 2 (one potential duplicate of #412, one unclear spec)

## Top 5 (by loop score)
- #487 (bug, p1, 2d old) — "Crash on export with large files" — suggested: bug + needs-repro + area:export
- ...
```

The loop prunes closed/merged items and only keeps "needs attention" items.

## How the Loop Runs (Typical Cycle)

1. Discover new/updated issues + discussions since last run (or all open if first run).
2. For each: summarize intent, detect duplicates (title + embedding hints or simple text match), pull signals (age, author, linked PRs, reactions, existing labels).
3. Score / bucket: P0 (security, prod breakage), P1 (high impact + clear), P2, P3, needs-info, duplicate.
4. Write or update a clean prioritized list + suggested label set + short "why this matters" into the state file (and optionally a comment on the issue itself as "Loop triage note").
5. Verifier (or human) reviews only the "needs human" bucket and any proposed label changes on sensitive areas.
6. Record run, prune resolved items, update counts.

## Verification Strategy

- The loop **never auto-labels or closes** in L1.
- In L2 it can apply allowlisted labels only (e.g. `area:*`, `needs-repro`) after verifier passes.
- Human always owns P0/P1 assignment for the first weeks and for anything touching auth, payments, security, or public API.

## Human Handoff Points

- Any issue touching security, auth, billing, or infra
- Duplicate detection that is uncertain (>30% chance wrong)
- Issues older than N days that the loop wants to close as "stale" (human confirms)
- When > X new issues appear in a single run (context overload signal)

## Tool-Specific Notes

**Grok Build TUI**:
```
/loop 2h Run issue-triage skill. Read issue-triage-state.md first. Produce updated state + suggested labels for new items only. No auto-label or close. Escalate anything ambiguous.
```

**Claude Code**:
```
/loop 2h $issue-triage — update issue-triage-state.md. Propose labels only on allowlisted areas. Human review for P0/P1.
```

**Codex**:
Automation every 2h or on `issues` event: run issue-triage → update state. Report mode.

**GitHub Actions**:
See `examples/github-actions/` for a starter workflow that can react to issue events + scheduled run.

## Failure Modes & Mitigations

| Failure                  | Mitigation |
|--------------------------|----------|
| Over-prioritizing noisy reporter | Weight by signals the team actually cares about (reactions, linked PRs, internal +1s). Human overrides recorded in state. |
| Duplicate false positives | Conservative matching + always surface "possible duplicate of #NNN" for human confirmation in L1. |
| Alert fatigue on every new issue | Only notify human for the "needs human" slice. Everything else lives in the state file that Daily Triage or the engineer reads. |

## Success Metrics

- Reduction in time from issue open → first meaningful label or "needs info" comment.
- % of issues that have a clear priority within 24h.
- Engineer-reported "I always know what the top 5 things are" score (qualitative, from state file reviews).
- Number of duplicates caught before two people start working on them.

See also: [Daily Triage](../daily-triage.md) (this loop is a feeder), [Multi-Loop Coordination](../docs/multi-loop.md), and the [Loop Design Checklist](../../docs/loop-design-checklist.md).
