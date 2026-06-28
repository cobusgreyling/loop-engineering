"""#3 — Walk-forward / K-of-N validation.

The single lockbox answers "did this one winner survive one holdout?" Walk-forward
answers the harder, more honest question: "does the *process* of picking a strategy
produce out-of-sample edge across many different market regimes?"

How it works:

    |--- in-sample ---|-- OOS 1 --|
    |------ in-sample ------|-- OOS 2 --|
    |--------- in-sample --------|-- OOS 3 --|   ... etc

For each fold we re-run the grid search on the in-sample window, take that
window's winner, and score it on the *next* (unseen) out-of-sample fold. That
gives N independent OOS results, each from params chosen without seeing them.

Two gates, both must pass:
  - Consistency (K-of-N): at least K folds clear a per-fold gate. A strategy that
    only works in 2017 fails here.
  - Aggregate honesty: pool every fold's OOS returns into one curve and require it
    to beat the deflated benchmark for ALL trials run (N folds x grid size), clear
    PSR >= 0.95, and stay under the drawdown cap.

Every fold's search ticks the trial counter, so re-optimizing N times raises the
deflated bar N-fold. Walk-forward is rigorous precisely because it is expensive in
trials — and the accounting makes you pay for them.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .data import Bar
from .strategy import generate_signals
from .backtest import run_backtest
from .search import expand_grid, DEFAULT_GRID
from . import stats


@dataclass
class Fold:
    index: int
    is_bars: int
    oos_bars: int
    winner_params: dict
    is_sharpe: float
    oos_sharpe: float
    oos_max_drawdown: float
    oos_trades: int
    passed: bool


@dataclass
class WalkForwardResult:
    folds: list[Fold]
    n_folds: int
    k_required: int
    passes: int
    consistency_pass: bool
    aggregate_sharpe: float
    aggregate_psr: float
    aggregate_max_drawdown: float
    deflated_benchmark: float
    aggregate_pass: bool
    passed: bool
    trials_this_run: int
    cumulative_trials: int

    def reasons(self) -> list[str]:
        return [
            f"{'PASS' if self.consistency_pass else 'FAIL'} · consistency: "
            f"{self.passes}/{self.n_folds} folds passed (need {self.k_required})",
            f"{'PASS' if self.aggregate_sharpe >= 1.0 else 'FAIL'} · aggregate_sharpe: "
            f"{self.aggregate_sharpe:.2f} vs floor 1.0",
            f"{'PASS' if self.aggregate_sharpe > self.deflated_benchmark else 'FAIL'} · "
            f"deflated_sharpe: {self.aggregate_sharpe:.2f} vs benchmark "
            f"{self.deflated_benchmark:.2f} (cumulative n_trials={self.cumulative_trials})",
            f"{'PASS' if self.aggregate_psr >= 0.95 else 'FAIL'} · probabilistic_sharpe: "
            f"{self.aggregate_psr:.3f} vs floor 0.95",
        ]

    def summary(self) -> dict:
        return {
            "n_folds": self.n_folds, "k_required": self.k_required, "passes": self.passes,
            "consistency_pass": self.consistency_pass,
            "aggregate_sharpe": self.aggregate_sharpe, "aggregate_psr": self.aggregate_psr,
            "aggregate_max_drawdown": self.aggregate_max_drawdown,
            "deflated_benchmark": self.deflated_benchmark,
            "aggregate_pass": self.aggregate_pass, "passed": self.passed,
            "trials_this_run": self.trials_this_run,
        }


def _equity(returns: list[float]) -> list[float]:
    eq = [1.0]
    for r in returns:
        eq.append(eq[-1] * (1.0 + r))
    return eq


def walk_forward(bars: list[Bar], *, n_folds: int = 5, k_required: int | None = None,
                 rolling_window_folds: int | None = None, grid: dict | None = None,
                 base_params: dict | None = None,
                 min_fold_sharpe: float = 0.5, max_fold_drawdown: float = 0.35,
                 min_aggregate_sharpe: float = 1.0, max_aggregate_drawdown: float = 0.25,
                 min_psr: float = 0.95, n_trials_so_far: int = 0,
                 fee_bps: float = 5.0, slippage_bps: float = 5.0,
                 periods_per_year: float = 365) -> WalkForwardResult:
    """Anchored by default (in-sample grows from the start). Set
    `rolling_window_folds` to use a fixed-size sliding in-sample window instead.
    """
    grid = grid or DEFAULT_GRID
    combos = expand_grid(grid)
    L = len(bars)
    fold_size = L // (n_folds + 1)
    if fold_size < 30:
        raise ValueError(f"need >= 30 bars/fold; got {fold_size} for {n_folds} folds on {L} bars")
    if k_required is None:
        k_required = (n_folds * 3 + 4) // 5  # ceil(0.6 * n_folds)

    folds: list[Fold] = []
    pooled_returns: list[float] = []
    trials = 0
    for i in range(n_folds):
        oos_start = (i + 1) * fold_size
        oos_end = L if i == n_folds - 1 else oos_start + fold_size
        if rolling_window_folds and rolling_window_folds > 0:
            is_start = max(0, oos_start - rolling_window_folds * fold_size)
        else:
            is_start = 0  # anchored
        is_bars = bars[is_start:oos_start]
        oos_bars = bars[oos_start:oos_end]

        best_params, best_sharpe = None, -1e9
        for params in combos:
            trials += 1  # every in-sample evaluation is a trial
            full = {**(base_params or {}), **params}
            r = run_backtest(is_bars, generate_signals(is_bars, full, periods_per_year=periods_per_year),
                             fee_bps=fee_bps, slippage_bps=slippage_bps,
                             periods_per_year=periods_per_year)
            if r.sharpe > best_sharpe:
                best_params, best_sharpe = full, r.sharpe

        oos = run_backtest(oos_bars, generate_signals(oos_bars, best_params, periods_per_year=periods_per_year),
                           fee_bps=fee_bps, slippage_bps=slippage_bps,
                           periods_per_year=periods_per_year)
        passed = oos.sharpe >= min_fold_sharpe and oos.max_drawdown <= max_fold_drawdown
        folds.append(Fold(
            index=i, is_bars=len(is_bars), oos_bars=len(oos_bars),
            winner_params=best_params, is_sharpe=round(best_sharpe, 3),
            oos_sharpe=round(oos.sharpe, 3), oos_max_drawdown=round(oos.max_drawdown, 4),
            oos_trades=oos.n_trades, passed=passed))
        pooled_returns.extend(oos.returns)

    passes = sum(1 for f in folds if f.passed)
    consistency_pass = passes >= k_required
    agg_sharpe = stats.sharpe(pooled_returns, periods_per_year)
    agg_dd = stats.max_drawdown(_equity(pooled_returns))
    psr = stats.probabilistic_sharpe(pooled_returns, 0.0, periods_per_year)
    cumulative_trials = n_trials_so_far + trials
    deflated = stats.deflated_benchmark_sharpe(
        n_obs=len(pooled_returns), n_trials=max(1, cumulative_trials),
        periods_per_year=periods_per_year)
    aggregate_pass = (agg_sharpe >= min_aggregate_sharpe and agg_sharpe > deflated
                      and psr >= min_psr and agg_dd <= max_aggregate_drawdown)

    return WalkForwardResult(
        folds=folds, n_folds=n_folds, k_required=k_required, passes=passes,
        consistency_pass=consistency_pass, aggregate_sharpe=round(agg_sharpe, 3),
        aggregate_psr=round(psr, 3), aggregate_max_drawdown=round(agg_dd, 4),
        deflated_benchmark=round(deflated, 3), aggregate_pass=aggregate_pass,
        passed=(consistency_pass and aggregate_pass), trials_this_run=trials,
        cumulative_trials=cumulative_trials)
