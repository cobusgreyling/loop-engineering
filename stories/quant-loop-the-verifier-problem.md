# Quant Trading Loop — The Verifier Problem

*Contributed by [@50thycal](https://github.com/50thycal) — adapted from [PR #136](https://github.com/cobusgreyling/loop-engineering/pull/136).*

A viral article ("loop engineering for quant trading") proposed running an entire
hedge fund as an autonomous loop. The architecture was the same five stages this
repo documents. But it shipped the loop at **L3 from day one, with real money,
and an LLM as the verifier.** We rebuilt it as a paper-only quant research loop
([reference implementation](https://github.com/50thycal/loop-engineering/tree/claude/code-review-discussion-9w5pnt/starters/quant-research-loop))
to show what changes when you keep the repo's discipline.

## Setup

- Domain: crypto strategy research
- Stages: ingest → signal (maker) → verify (checker) → execute → risk
- Posture in the article: live execution, `@auto_mode`, "prints alpha 24/7"
- Posture here: **paper-only, numerical checker, report-first**

## What the article got right

- Quant trading genuinely *is* a loop (pull → signal → backtest → execute → repeat).
- The six primitives transfer cleanly (automation, skill, state, verifier,
  worktrees, connectors).
- Its closing warning is correct and is this repo's gospel: stop conditions must
  be checkable by something other than the agent's own claim.

## What broke (in the article's design)

- **The verifier was an LLM asked to opine on a backtest.** A backtest's failure
  mode is *overfitting*, not faulty reasoning. A second opinion cannot catch a
  curve-fit — the backtest is *already* the overfit artifact. Maker/checker only
  helps when the checker does something the maker structurally cannot fake.
- **"Self-improving" was self-overfitting.** Appending a rule after every loss
  (skip FOMC, cap sector at 30%) is in-sample patching. After 1,000 trades you
  have a ruleset shaped by one path of history, not institutional knowledge.
- **L3 with real money on cycle one.** No paper phase, no human gate, capital as
  the blast radius.

## What we changed

- The checker is **numerical and non-overridable**: out-of-sample split, deflated
  Sharpe vs `n_trials`, Probabilistic Sharpe ≥ 0.95, drawdown cap, IS→OOS
  degradation guard. An LLM may narrate it; it may never overturn it.
- Execution is **paper-only**. Live is a separate, human-gated project.
- Every "lesson" is a hypothesis to **re-test out-of-sample**, never a patch.

## The demonstration

Run `python3 -m engine.loop --once` on the default synthetic (random-walk) data:

| Window | Sharpe | Verdict |
|--------|--------|---------|
| In-sample | **+2.54** | looks like a winner |
| Out-of-sample | **−4.33** | falls apart |
| Checker | — | **REJECT — no trade** |

The in-sample Sharpe of 2.54 is exactly the number that would make a retail quant
(or an LLM verifier) ship it. The numerical checker sees the OOS collapse and
refuses to trade. **That refusal is the product.**

## Lesson

The loop is plumbing; it does not manufacture alpha. The maker/checker split is
worthless unless the checker measures something the maker cannot fake. In code,
that's an independent re-derivation of correctness. In trading, it's
out-of-sample, cost-aware, multiple-testing-penalized statistics — never a second
agent's vibe. Phase to live (L1 paper → L2 walk-forward → L3 gated execution);
do not start where the blast radius is capital.