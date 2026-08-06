# Issue + PR Repair Starter

Install the combined bug/PR repair and exact-revision promotion pattern:

```bash
npx @cobusgreyling/loop-init . --pattern issue-pr-repair --tool codex
```

The starter installs the repair policy, promotion contract, state spine,
budget/circuit-breaker files, and the `issue-pr-repair` workflow skill. Start in
report-only mode while adapting the GitHub evidence collector and test
deployment receipt publisher to the repository.

Verify the installed planner before connecting live GitHub data:

```bash
npx @cobusgreyling/loop-gate repair-plan \
  --contract repair.yaml \
  --evidence repair-evidence.example.json \
  --json
```

Recommended rollout:

1. Run deterministic intake only and verify early exits.
2. Enable leases and diagnosis, but no code changes.
3. Enable draft-PR fixes for low/medium-risk allowlisted paths.
4. Enable exact-SHA test deployment and acceptance.
5. After at least three successful trials, consider low-risk auto-merge.

See the [coAligne implementation](../../examples/coaligne/README.md) for a
working GitHub + Drone adapter with synthetic data and API/browser E2E.
