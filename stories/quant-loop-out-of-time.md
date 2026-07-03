# Quant Loop, Part II — The Strategy That Passed Research and Still Failed

*Contributed by [@50thycal](https://github.com/50thycal) — adapted from [PR #136](https://github.com/cobusgreyling/loop-engineering/pull/136).*

A follow-up to [the verifier problem](quant-loop-the-verifier-problem.md). We took
the [quant research loop](https://github.com/50thycal/loop-engineering/tree/claude/code-review-discussion-9w5pnt/starters/quant-research-loop)
from "reject overfit garbage" to "hunt for a real strategy," built the anti-self-deception guards the
job demands, then tried to beat them on real BTC. The punchline is the most useful
thing a research harness can produce: **a strategy that cleared honest research and
still failed on data it had never seen.**

## Setup

- Pattern: quant research loop (paper-only, L1/L2), daily BTC close 2010–2026
- Guards built, in order: enforced trial counting → write-once lockbox →
  walk-forward K-of-N → research-budget auto-halt → forward quarantine
- Hypotheses: donchian breakout, time-series momentum, short-term mean reversion,
  volatility-regime-filtered trend — all with an optional vol-targeting overlay

## What Worked

- **The guards caught every form of self-deception we threw at them.** Overfit
  grid winners died in the lockbox. A strategy with a great *pooled* Sharpe but
  50%+ drawdowns in 3 of 5 regimes died on the K-of-N consistency gate. A forever
  loop got halted by the trial budget.
- **Volatility targeting was a genuine, non-cheating improvement** — it cut
  drawdowns structurally (lower risk targeting generalizes to any data), not by
  curve-fitting.
- **The forward quarantine did the one thing nothing else could:** judged
  strategies on out-of-time data that no search, tuning, or bake-off had touched.

## What Broke (the good kind)

- **We caught ourselves cheating.** Sweeping `target_vol` by hand until a strategy
  passed is *uncounted multiple testing* — the enforced counter tracks the grid,
  not the researcher. Recognizing that, on the page, was the real deliverable.
- **`regime` passed honest research — then failed reality.** The volatility-regime
  trend filter became the first strategy to clear walk-forward on 2010–2020 (5/5
  folds, 14% drawdown). On genuinely unseen 2020–2026 it fell apart (37% drawdown).
  Research success did not survive out-of-time.
- **"Made money" ≠ "has edge."** Every strategy posted big 2020–2026 returns
  (momentum +531%) — because BTC rose. All carried 37–41% drawdowns and sub-bar
  risk-adjusted returns. That is beta to a bull market wearing an alpha costume.

## Metrics (true out-of-time test: research 2010–2020, forward 2020–2026)

| Strategy | Research | Forward (unseen) | Approved |
|----------|----------|------------------|----------|
| regime | **PASS** (5/5, 14% DD) | REJECT — Sharpe 0.82, +161%, 37% DD | No |
| donchian | REJECT | REJECT — +286%, 41% DD | No |
| tsmom | REJECT | REJECT — +531%, 39% DD | No |
| meanrev | REJECT (0/5) | REJECT — +7%, 38% DD | No |

## Lesson

A research harness that only ever says "yes" is worthless; its value is in the
"no"s you would not have said yourself. Ours said no to a strategy that passed
every in-sample test, because the one judge that cannot be tuned — out-of-time
data — disagreed. The loop did not find alpha. It did something more valuable for
a solo builder: it stopped us deploying beta dressed as alpha, and it made the
cost of fooling ourselves visible at every step. Build the loop to be the engineer
who stays honest, not the one who presses go on a +531% backtest.