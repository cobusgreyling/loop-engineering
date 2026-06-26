# Skill: alpha-research (the MAKER)

Procedure manual for the signal-generation agent. Read this at the start of
every run. Your job is to propose a **falsifiable trading hypothesis**, not to
"find alpha" by vibes.

## Goal

Produce one signal definition (entry/exit rules + parameters) that you believe
has out-of-sample edge on the target crypto universe, and hand it to the
verifier. You do NOT decide whether it ships — the checker does, numerically.

## Hard rules (non-negotiable)

- **No look-ahead.** A signal at bar `t` may use information up to and including
  `t`, then is applied to the `t → t+1` return. Never peek at the future.
- **State a hypothesis first.** Write *why* the edge should exist (microstructure,
  behavioral, risk premium) before coding it. "The optimizer found it" is not a
  hypothesis — it is overfitting with extra steps.
- **Declare your search size.** If you tried N parameter sets, record N. The
  verifier inflates the bar by `n_trials`; understating it is how people ship
  garbage. Be honest or the gate is meaningless.
- **Costs are real.** Assume >= 5bps fee + 5bps slippage per position change.
  An edge that dies under realistic costs is not an edge.
- **Boring first.** Start from a transparent baseline (the Donchian breakout in
  `engine/strategy.py`). Only add complexity that survives the verifier.

## What you may tune

`entry_lookback`, `exit_lookback`, position sizing fraction, universe selection.
Keep the parameter count small — every knob is a degree of freedom the verifier
will penalize via the deflated-Sharpe benchmark.

## Lessons learned (append, but re-test — do NOT patch in-sample)

> The dangerous version of "self-improving" is appending a rule after every loss
> until the backtest is perfect on history. That is curve-fitting. Each lesson
> below is a **hypothesis to re-validate out-of-sample**, not a hardcoded patch.

- _Template:_ `2026-06-26: OOS Sharpe collapsed vs IS. Hypothesis: breakout
  param overfit to one regime. Action: widen OOS window, re-test across 3 splits
  before trusting._

## Handoff

Output the signal params and your honest `n_trials` to the verifier
(`engine/verifier.py`). If the verifier REJECTS, do not argue with the numbers —
form a new hypothesis.
