"""The search harness — turns 'find a strategy' into a loop, with ENFORCED trial
counting so the loop cannot lie to you about how many ideas it tried.

The article's whole pitch is being less in the loop. The danger of being less in
the loop is that nobody is counting how many parameter sets got tried before the
"winner" emerged — and the winner of 1,000 random tries looks great by luck. So
the counter is not optional and not on the honor system: every candidate the
search evaluates ticks it, and that count flows straight into the verifier's
deflated-Sharpe gate.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product

from .data import Bar
from .strategy import generate_signals
from .backtest import run_backtest


DEFAULT_GRID = {
    "entry_lookback": [20, 30, 40, 55, 70, 90, 110],
    "exit_lookback": [10, 15, 20, 30, 40],
}


@dataclass
class TrialCounter:
    n: int = 0

    def tick(self, k: int = 1) -> None:
        self.n += k


@dataclass
class Candidate:
    params: dict
    validation_sharpe: float
    train_sharpe: float
    validation_summary: dict


def expand_grid(grid: dict) -> list[dict]:
    keys = list(grid)
    return [dict(zip(keys, combo)) for combo in product(*[grid[k] for k in keys])]


def grid_search(train_bars: list[Bar], validation_bars: list[Bar],
                counter: TrialCounter, *, grid: dict | None = None,
                fee_bps: float = 5.0, slippage_bps: float = 5.0,
                periods_per_year: float = 24 * 365) -> list[Candidate]:
    """Rank candidates by VALIDATION Sharpe. Train metrics come along for the
    degradation guard. The lockbox is never touched here — that is the point.

    Returns candidates sorted best-first. The caller MUST persist `counter.n`
    into the research ledger; that is what makes the trial count enforced.
    """
    grid = grid or DEFAULT_GRID
    candidates: list[Candidate] = []
    for params in expand_grid(grid):
        counter.tick()  # ENFORCED: one evaluation == one trial, no exceptions
        tr = run_backtest(train_bars, generate_signals(train_bars, params),
                          fee_bps=fee_bps, slippage_bps=slippage_bps,
                          periods_per_year=periods_per_year)
        va = run_backtest(validation_bars, generate_signals(validation_bars, params),
                          fee_bps=fee_bps, slippage_bps=slippage_bps,
                          periods_per_year=periods_per_year)
        candidates.append(Candidate(
            params=params,
            validation_sharpe=va.sharpe,
            train_sharpe=tr.sharpe,
            validation_summary=va.summary(),
        ))
    candidates.sort(key=lambda c: c.validation_sharpe, reverse=True)
    return candidates
