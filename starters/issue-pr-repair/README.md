# Issue + PR Repair Starter

Install the combined bug/PR repair and exact-revision promotion pattern:

```bash
npx @cobusgreyling/loop-init . --pattern issue-pr-repair --tool codex
```

The starter installs the repair policy, promotion contract, state spine,
budget/circuit-breaker files, the `issue-pr-repair` workflow skill, and
dry-run-first GitHub intake/lease adapters. Start in report-only mode while
adapting the test deployment receipt publisher to the repository.

## First dry run

Authenticate `gh`, install the default labels, and collect authoritative state:

```bash
gh auth status
node scripts/install-github-labels.mjs --repository owner/repo
# Review the JSON, then repeat with --execute.
node scripts/collect-repair-evidence.mjs \
  --repository owner/repo \
  --required-check "your-required-check" \
  --output .loop/repair-evidence.json
```

Run the deterministic planner against that fresh evidence:

```bash
npx @cobusgreyling/loop-gate repair-plan \
  --contract repair.yaml \
  --evidence .loop/repair-evidence.json \
  --json > .loop/repair-decision.json
```

Inspect a lease without mutating GitHub:

```bash
node scripts/repair-lease.mjs \
  --repository owner/repo \
  --decision .loop/repair-decision.json \
  --risk low
```

Only add `--execute` after the decision and proposed labels are correct. Always
run the matching `--release --execute` command from finally-style cleanup.

Recommended rollout:

1. Run deterministic intake only and verify early exits.
2. Enable leases and diagnosis, but no code changes.
3. Enable draft-PR fixes for low/medium-risk allowlisted paths.
4. Enable exact-SHA test deployment and acceptance.
5. After at least three successful trials, consider low-risk auto-merge.

See the [coAligne implementation](../../examples/coaligne/README.md) for a
working Drone promotion adapter with synthetic data and API/browser E2E.
