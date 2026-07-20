# The Score Climbed to 100. Then the Budget Burned.

*Subtitle: Loop Ready measures scaffold — not permission to let agents write unattended.*

---

You can make an AI coding agent look brilliant for an afternoon.

You can also burn a week of token budget overnight fixing the same flaky test.

This is a field note from dogfooding [Loop Engineering](https://github.com/cobusgreyling/loop-engineering) — the patterns, starters, and CLIs for designing systems that prompt your agents (instead of you re-prompting every morning).

If you only remember one line:

> **A Loop Ready score of 100 is a landing checklist, not a green light for auto-fix.**

---

## The 15-second dopamine hit

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop-audit . --suggest
```

On a greenfield or “we have AGENTS.md and chaos” repo, the score can climb from the teens into the 90s once you have:

- a pattern and skills  
- `STATE.md` / loop files  
- budget + constraints  
- a run log  

That climb is real. It’s also **dangerous** if you confuse *readiness of the harness* with *permission to merge*.

We shipped a clearer path in [v1.6.0](https://github.com/cobusgreyling/loop-engineering/releases/tag/v1.6.0): `loop-init --with-foundry`, `loop-audit` 1.7 Harness Runtime signals, and `loop-gate` for mechanical denylists.

---

## Week one: the part that worked

We ran **Daily Triage** in **report-only** mode.

No auto-close. No auto-merge. No “just fix main” ambition.

The loop’s job was to produce a human-readable agenda: stale PRs, flaky suites, normalized red builds. Humans acted on the report in standup.

That week was boring. Boring is the goal.

---

## Week two: the part that failed

Day six, we “graduated” to a CI Sweeper on a tight cadence.

We skipped:

1. A **separate** verifier (maker graded its own homework)  
2. A **branch allowlist** (feature-branch chaos entered the loop)  
3. A **hard stop** on daily tokens (cadence compounds faster than Slack)

Within 48 hours the ledger looked like a runway fire: millions of tokens, symptom PRs, state drift, and one config change that would have broken prod if a human hadn’t caught it.

We killed the sweeper. We went back to report-only. We wrote the failure down so we wouldn’t relearn it as folklore.

(Repo story: [`score-climbs-then-budget-burns.md`](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/score-climbs-then-budget-burns.md) · earlier cousin: [why we killed CI sweeper](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/why-we-killed-ci-sweeper.md).)

---

## The design rule

| Phase | Allowed | Forbidden |
|-------|---------|-----------|
| L1 (week one+) | Report, label proposals, draft notes | Unattended code changes |
| L2 (only after L1 is boring) | Fixes in worktrees, gated PRs | Direct pushes, prod-path writes without `loop-gate` |
| Always | Budget stop conditions, human merge | “The score was high so we turned on everything” |

Loop engineering is not prompt engineering with a stopwatch.

It’s **systems design**: schedule, skills, state, verification, handoff, budget.

---

## What to run tomorrow morning

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --cadence 1d
```

When the score is high **and** report-only has been boring for two weeks, then consider L2 — and version the loop as a harness (`--with-foundry`) so you can evolve it without folklore.

---

## Join the loop

- Repo: https://github.com/cobusgreyling/loop-engineering  
- Release: https://github.com/cobusgreyling/loop-engineering/releases/tag/v1.6.0  
- Show your score: https://github.com/cobusgreyling/loop-engineering/discussions/326  
- Ask anything: https://github.com/cobusgreyling/loop-engineering/discussions/327  

If you post a score, post a failure too. That’s the culture.

— Cobus
