# Post-Merge Cleanup Loop

**Goal**: After merges to main, sweep for follow-up work — deprecations, TODOs, tech debt tickets, stale feature flags, and documentation gaps — without blocking the merge itself.

## Scheduling

**Recommended**:
- `/loop 1d` or `/loop 6h` (lower urgency than CI sweeper)
- Trigger on merge events via GitHub webhook → Action (event-driven)
- Weekly cron for smaller teams

Run after working hours or overnight so it doesn't compete with active development loops.

## Required Skills

- `post-merge-scan` — Read recent merges, diff summaries, linked tickets; identify cleanup opportunities
- `minimal-fix` — Small follow-ups (remove dead code, update deprecation notices, fix broken links in docs)
- Project conventions skill — What "cleanup" means in your repo

## State

`post-merge-state.md`:

```markdown
# Post-Merge Cleanup

Last run: 2026-06-09 22:00 UTC

## Pending Cleanup (from recent merges)
- [ ] PR #1245 merged — remove `legacyAuth` flag (marked TODO in merge)
  Source: commit abc1234, line 42 in auth/handler.ts
  Risk: low | Effort: small
- [ ] PR #1240 merged — update API docs for new endpoint
  Risk: low | Effort: small

## Completed (last 14d)
- PR #1230 — removed unused import cluster (PR #1248)

## Deferred (human decision)
- PR #1238 — large refactor deferred; ticket ENG-1001 created
```

## How the Loop Runs (Typical Cycle)

1. List merges to main since last run (or last N days).
2. For each merge: scan diff for TODOs, deprecations, `// remove after`, feature flags, broken doc links.
3. Cross-reference linked Linear/GitHub issues for explicit follow-ups.
4. Prioritize: small + low-risk → propose fix in worktree; large → create ticket + flag human.
5. Verifier confirms cleanup doesn't change behavior (except intentional removals).
6. Open small PRs or batch into a single "cleanup" PR per day.
7. Update state; prune completed items.

## Circuit Breaker

This is a fix-capable (L2) pattern, so `loop-init` scaffolds the `loop-guard` skill and a seeded `loop-ledger.json` for it automatically. Run the circuit breaker before each retry on the same regression:

```bash
npx @cobusgreyling/loop-context --check --ledger loop-ledger.json \
  --budget-from-pattern post-merge-cleanup --budget-level L2
```

Non-zero exit means the same failure repeated or the attempt cap was hit —
stop and escalate to a human. See [docs/safety.md](../docs/safety.md).

## Verification Strategy

- Cleanup must not alter behavior unless explicitly removing dead code paths.
- Verifier runs full test suite — regressions mean immediate handoff.
- No auto-merge for cleanup PRs touching >10 files without human approval.

## Human Handoff Points

- Architectural debt requiring design discussion
- Feature flag removal that affects production config
- Deprecations with external API consumers
- Any cleanup the loop has attempted twice without passing tests

## Tool-Specific Notes

**Grok Build TUI**:
```bash
/loop 1d Scan merges to main in the last 24h. Identify cleanup items. For small low-risk items: worktree + minimal fix + verifier. Update post-merge-state.md. Create tickets for larger items.
```

**Claude Code**:
```bash
/loop 6h /post-merge-sweeper
```
(Boris Cherny has described similar flows in the community.)

**Codex**:
- Automation: "Post-merge sweeper" on daily cadence, results to Triage inbox.

**GitHub Actions**:
- See `examples/github-actions/post-merge-cleanup.yml` — triggers on push to main.

## Failure Modes & Mitigations

| Failure | Mitigation |
|---------|------------|
| Over-aggressive deletion | Verifier + "no behavior change" rule; human gate for large diffs |
| Missing merges | Use GitHub API merge list, not just local git log |
| Noise from every TODO | Only act on TODOs with merge context or linked tickets |
| Competing with feature work | Run off-peak; cap auto-PRs per day (e.g. 2) |

## Cost Profile

| Scenario | Tokens/run | Notes |
|----------|------------|-------|
| No-op | ~5k | No recent merges to scan |
| Scan + prioritize | ~40k | Merge list + TODO scan |
| Small fix (L2) | ~150k | Worktree + verifier |

**Cadence**: 1d–6h · **Tier**: low · **Suggested daily cap**: 200k tokens

```bash
npx @cobusgreyling/loop-cost --pattern post-merge-cleanup --cadence 1d --level L1
```

Run off-peak. Cap auto-PRs per day in `loop-budget.md`.

## Success Metrics

- Reduction in "we forgot to remove X after merge" incidents
- Age of open post-merge cleanup items
- % of cleanup PRs merged without review comments

Lower risk than CI sweeper — good second loop after daily triage is stable.