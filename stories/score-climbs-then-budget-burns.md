# The Score Climbed to 100. Then the Budget Burned.

*Production story — week-one win, week-two failure. Companion to [v1.6.0](https://github.com/cobusgreyling/loop-engineering/releases/tag/v1.6.0).*

## Context

Pattern: **Daily Triage** → premature **CI Sweeper**  
Tools: Claude Code + GitHub Actions  
Level: L1 report-only (days 1–5), then L2 auto-fix too early (day 6)

## What worked (week one)

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop-audit . --suggest
```

Loop Ready went **~15 → 92** in an afternoon: `STATE.md`, skills, budget file, constraints, run log. The audit `--suggest` list was the actual roadmap — not a vanity score.

Daily Triage in **report-only** mode surfaced:

- 4 stale PRs with no reviewers
- 1 flaky suite that had been “someone else’s problem” for weeks
- A `main` red that humans had normalized

No auto-merge. No unattended writes. Humans used the report as a standup agenda.

## What failed (week two)

On day 6 we “graduated” to CI Sweeper on a 15-minute cadence **without**:

1. A separate verifier agent  
2. A branch allowlist (`main` only)  
3. A hard daily token cap enforced outside the model’s goodwill  

Within 48 hours:

- ~**6–8M tokens** spent chasing the same flaky test  
- Multiple fix PRs that treated symptoms (sleep, retry) not cause  
- `STATE.md` and the run log disagreed about what was “done”  
- Human review caught one config change that would have broken prod deploys  

We killed the sweeper (`scheduler_delete` / disabled Action), rewrote the budget, and returned to Daily Triage report-only for another week. See also [`why-we-killed-ci-sweeper.md`](./why-we-killed-ci-sweeper.md).

## Root causes

| Miss | Why it hurt |
|------|-------------|
| Score ≠ permission | Loop Ready 90+ measures *scaffold*, not *license to auto-fix* |
| Same-session verifier | Maker graded its own homework |
| No worktree isolation | Partial fixes polluted the working tree mid-loop |
| Cadence without budget | 15m ticks compound faster than humans notice |

## What we changed

1. **L1 until boring** — two clean weeks of report-only before any L2  
2. **`loop-gate` + denylist** — mechanical blocks on prod paths ([v1.6.0](https://github.com/cobusgreyling/loop-engineering/releases/tag/v1.6.0))  
3. **Verifier as separate pass** — different agent / higher scrutiny  
4. **Budget as stop condition** — when the ledger trips, the loop stops, full stop  
5. Optional **`--with-foundry`** when promoting a stable loop to a versioned harness

## Lesson

A climbing Loop Ready score is a *landing checklist*, not a green light for unattended writes. Design the loop, measure readiness, then **earn** auto-fix with boring report-only weeks — not with a badge.

## Try the safe path

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d
```

Share your score or failure: [Show your loop](https://github.com/cobusgreyling/loop-engineering/discussions/326).
