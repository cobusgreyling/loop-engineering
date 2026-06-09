# Which Pattern When?

Pick one primary loop per concern. Overlapping loops need coordination — see [multi-loop.md](./multi-loop.md).

```mermaid
flowchart TD
    A[What hurts right now?] --> B{CI red?}
    B -->|yes| C[CI Sweeper]
    B -->|no| D{PRs stalling?}
    D -->|yes| E[PR Babysitter]
    D -->|no| F{Morning chaos or noisy issues?}
    F -->|yes| G[Daily Triage + Issue Triage]
    F -->|no| H{Dependabot / CVE noise?}
    H -->|yes| I[Dependency Sweeper]
    H -->|no| J{Merge debt / TODOs piling up?}
    J -->|yes| K[Post-Merge Cleanup]
    J -->|no| L{Release notes / changelog stale?}
    L -->|yes| M[Changelog Drafter]
    L -->|no| N{Tight token budget?}
    N -->|yes| M
    N -->|no| G
```

## Cost-aware picks

Estimate before you schedule:

```bash
npx @cobusgreyling/loop-cost --pattern <id> --level L1
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok   # scaffolds loop-budget.md + loop-run-log.md
```

| Situation | Prefer | Avoid (until budget + early-exit) |
|-----------|--------|-----------------------------------|
| Hobby / tight plan | Changelog Drafter, Daily Triage (L1), Post-Merge | CI Sweeper at 5m, PR Babysitter at 5m |
| Active CI fires | CI Sweeper at **15m+** with early-exit | Full triage every 5m when main is green |
| Many open PRs | PR Babysitter at 10–15m, L1 watch first | L2 fix loops on every tick |
| Release week | Changelog Drafter daily | Dependency Sweeper + CI Sweeper unattended |

`loop-audit` caps **L3** until `loop-budget.md`, `loop-run-log.md`, and a `LOOP.md` budget section exist.

## Quick reference

| Symptom | Pattern | Start with |
|---------|---------|------------|
| CI failing on main or PRs | [CI Sweeper](../patterns/ci-sweeper.md) | L2, 15m cadence, max 3 attempts |
| PRs waiting on review/CI/rebase | [PR Babysitter](../patterns/pr-babysitter.md) | L1 watch → L2 assisted |
| "What should I work on?" every morning or noisy GitHub issues | [Daily Triage](../patterns/daily-triage.md) + [Issue Triage](../patterns/issue-triage.md) (new) | **L1 report-only week one** — low risk, excellent pair |
| Outdated packages / CVE alerts | [Dependency Sweeper](../patterns/dependency-sweeper.md) | L2 patch-only, denylist majors |
| TODOs and cleanup after merges | [Post-Merge Cleanup](../patterns/post-merge-cleanup.md) | L1 off-peak, small fixes only |
| Stale or missing release notes | [Changelog Drafter](../patterns/changelog-drafter.md) | **L1** (draft only first), very low risk |

## Overlap rules

| Combination | Rule |
|-------------|------|
| CI Sweeper + PR Babysitter | CI Sweeper owns failing checks; PR Babysitter does not re-fix the same branch in the same hour |
| Daily Triage + anything | Daily Triage reports; action loops execute. Triage does not auto-fix in L1 |
| Dependency Sweeper + CI Sweeper | Pause Dependency Sweeper while CI is red on main |
| Post-Merge + PR Babysitter | Post-Merge runs off-peak only |
| Changelog Drafter + anything | Changelog Drafter is read-mostly and safe to run alongside others; it should not auto-publish |

## First loop recommendation

If unsure, start with **Daily Triage at L1**. It teaches state discipline without auto-merge risk.

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
```