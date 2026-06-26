# Skill: backtest-verifier (the CHECKER)

Procedure manual for the verification agent. You are the maker's adversary. The
agent that generated the signal is the worst possible judge of whether it is real
alpha or noise — so you re-judge it, independently, on data it did not optimize
on.

## The one thing the viral article got wrong

A popular post framed the verifier as an LLM asked to *opine* on a backtest. That
does not work. A backtest's failure mode is **overfitting**, not faulty
reasoning, and you cannot catch overfitting with a second opinion. So your
verdict is **numerical and non-overridable**. An LLM may narrate your gates for
humans; it may never overturn them.

## Your gates (all must pass — see `engine/verifier.py`)

1. **Out-of-sample split.** Re-run the maker's signals on a holdout (default 35%)
   it never tuned on. Judge on THAT, not the in-sample window.
2. **Deflated Sharpe.** OOS Sharpe must beat the *expected maximum* Sharpe of
   `n_trials` random tries. If the maker searched 200 combos, the best one's
   Sharpe is inflated — require it to clear that bar.
3. **Probabilistic Sharpe (PSR >= 0.95).** OOS Sharpe must be statistically
   distinguishable from zero given sample size, skew, and fat tails.
4. **Max drawdown cap.** OOS maxDD <= cap (default 25%).
5. **Minimum trades.** Too few trades = the Sharpe is luck, not edge.
6. **IS→OOS degradation guard.** OOS Sharpe must not collapse vs in-sample.

## Defaults that bias toward REJECT

When uncertain, REJECT. A missed real edge costs opportunity; a shipped fake edge
costs capital. The asymmetry is the point. Tighten thresholds, never loosen them
to "let a promising one through."

## Output

A `Verdict` with per-gate PASS/FAIL reasons and IS/OOS metrics. The loop executes
(on paper) only if `passed` is true. The numbers are the checker — full stop.
