# Dependency Sweeper Loop

**Goal**: Discover outdated or vulnerable dependencies, apply the smallest safe updates, verify with tests/builds in isolation, and escalate anything risky (major bumps, breaking changes, or high-severity vulns) to a human.

## Scheduling

**Recommended**:
- Grok: `/loop 6h dependency-sweeper` (or daily during business hours)
- Claude Code: `/loop 12h /sweep-deps` + `/goal keep the dependency surface clean and green`
- Codex: scheduled automation running the triage + minimal-fix flow every 4-12h
- GitHub Actions: Dependabot + a scheduled or workflow_dispatch sweeper (see `examples/github-actions/` patterns)

Run more frequently after Dependabot or OSV alerts fire. Slow down or pause on major release trains.

## Required Skills

- `dependency-triage` — Parses lockfiles/package manifests, groups updates by risk (patch/minor/major + known CVEs), produces a short actionable list with suggested next version and justification.
- `minimal-fix` — Applies the smallest possible change (usually just version bumps + lockfile update) and nothing else.
- `loop-verifier` (or project test script) — Runs the project's test/build/lint in a clean worktree and confirms the change did not introduce regressions.

## State

Filename: `dependency-sweeper-state.md`

Keep a compact list of in-flight updates, last action, and human decisions:

```markdown
- package.json (lodash): 4.17.21 → 4.17.21 (CVE-2021-23337) — applied patch, tests green
  Last: 2025-06-09T09:12Z
  Human: approved minor for express (was on denylist for this sprint)
- (resolved) react: minor bump — merged
```

Prune merged/closed entries on every run.

## How the Loop Runs (Typical Cycle)

1. Scan manifests + lockfiles + any security advisories (Dependabot, OSV, npm audit, etc.).
2. Triage into safe (patch + no CVE), cautious (minor), and high-risk (major or high-severity CVE).
3. For safe items: spawn a worktree, apply minimal version + lock update via minimal-fix skill, run verifier (tests + build).
4. If verifier passes → open or update a small PR (or commit if allowed on a dependency branch) and record in state.
5. For cautious/high-risk → add to state with clear "needs human" flag + context (changelog diff summary, CVE link).
6. Update the state file and (optionally) comment on open dependency PRs.
7. On next run, re-evaluate open items and close stale or conflicting ones.

## Circuit Breaker

This is a fix-capable (L2) pattern, so `loop-init` scaffolds the `loop-guard` skill and a seeded `loop-ledger.json` for it automatically. Before each retry on the same package, run the circuit breaker:

```bash
npx @cobusgreyling/loop-context --check --ledger loop-ledger.json \
  --budget-from-pattern dependency-sweeper --budget-level L2
```

If the same failure recurs or the attempt cap is hit (see "Escalate after 2
tries" below), it exits non-zero — stop retrying and escalate to a human
instead of looping. See [docs/safety.md](../docs/safety.md).



## Verification Strategy

- **Never** let the implementer sub-agent declare success.
- Always run the verifier sub-agent (or explicit `npm test && npm run build`) in an isolated worktree.
- The loop only proposes the change or a PR. Human (or an allowlist for "known-safe patches") performs the actual merge.
- For security updates, prefer the smallest patch that resolves the advisory.

## Human Handoff Points

- Any major version bump or change that touches lockfile in > N packages at once.
- High or critical CVEs (even if a patch exists).
- Packages on an explicit denylist (auth, payments, core infra, large internal monorepo packages).
- After N automated attempts on the same dep without progress.
- When tests or type checks fail in the verifier worktree.

## Tool-Specific Notes

**Grok Build TUI**:
- Use `/loop 6h Run dependency-triage. For safe patches create minimal PRs in worktrees. Never auto-merge majors or CVEs above medium.`
- Combine with the scheduler and worktree primitives.

**Claude Code**:
- Boris-style loops work extremely well here: one loop for discovery/triage, sub-agents for the minimal bump + verify.
- Use `/goal` to keep "dependency surface clean with no high sev vulns and < 5 open minor updates".

**GitHub Actions / Dependabot**:
- Let Dependabot open the PRs. The sweeper's job becomes "triage the Dependabot PRs, apply minimal additional fixes if the bot's PR is blocked, rebase, and ping for review on risky ones".
- See the example workflow in `examples/github-actions/`.

**Codex**:
- Schedule a recurring Codex task that runs the triage skill against package.json + package-lock.json and produces the state update + suggested diffs.

## Failure Modes & Mitigations

| Failure | Mitigation |
|---------|------------|
| Loop applies a "safe" update that breaks the build in prod | Strong verifier in worktree + never auto-merge anything without explicit allowlist + human review for anything beyond patch. |
| Infinite update churn (A depends on B which reverts) | Limit attempts per package per 24h. Record last attempted version in state. Escalate after 2 tries. |
| Security patch introduces a new vuln elsewhere | The verifier should include `npm audit` (or equivalent) after the change. |
| Update touches dozens of transitive deps at once | Treat as high-risk. Only touch direct deps in the minimal-fix step. |
| Notification spam | Only notify human for items in the "needs human" section of state. Everything else is silent or summarized daily. |

## Cost Profile

| Scenario | Tokens/run | Notes |
|----------|------------|-------|
| No-op (nothing to bump) | ~5k | Exit when scan is clean |
| Triage / scan | ~60k | Audit + Dependabot + lockfile scan |
| Patch + verify (L2) | ~300k | Worktree + full test suite |

**Cadence**: 6h–1d · **Tier**: medium · **Suggested daily cap**: 500k tokens

```bash
npx @cobusgreyling/loop-cost --pattern dependency-sweeper --level L2
```

Verifier runs (`npm ci && npm test`) dominate cost — cap attempts per package in `loop-budget.md`.

## Success Metrics

- Median time from "vulnerability published / Dependabot PR opened" → merged (for items the loop touched).
- Number of high/critical vulns open > 48h (target near zero).
- % of dependency PRs that were purely "LGTM, loop handled the bump + verified".
- Reduction in "can you bump X?" messages in Slack/Linear.

Start with **patch-level only + known CVE fixes** on a single repo for 1-2 weeks. Expand to minors only after you trust the verifier. Majors and breaking changes should stay human-gated for a long time.
