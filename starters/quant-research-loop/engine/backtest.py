"""Stage 3a — Backtest engine (vectorized-ish, pure stdlib).

Models the two costs retail backtests "forget" and thereby manufacture fake
alpha: trading fees and slippage, charged on every position change.
"""
from __future__ import annotations

from dataclasses import dataclass

from .data import Bar
from . import stats


@dataclass
class BacktestResult:
    n_bars: int
    n_trades: int
    total_return: float
    cagr: float
    sharpe: float
    max_drawdown: float
    hit_rate: float
    returns: list[float]
    equity: list[float]

    def summary(self) -> dict:
        return {
            "n_bars": self.n_bars,
            "n_trades": self.n_trades,
            "total_return": round(self.total_return, 4),
            "cagr": round(self.cagr, 4),
            "sharpe": round(self.sharpe, 3),
            "max_drawdown": round(self.max_drawdown, 4),
            "hit_rate": round(self.hit_rate, 3),
        }


def run_backtest(bars: list[Bar], signals: list[int], *,
                 fee_bps: float = 5.0, slippage_bps: float = 5.0,
                 periods_per_year: float = 24 * 365) -> BacktestResult:
    """fee_bps + slippage_bps are charged on the *traded* notional each time the
    target position changes. 5bps + 5bps = 10bps round-trip-ish per change is a
    realistic-to-generous assumption for liquid crypto.
    """
    assert len(bars) == len(signals), "signals must align with bars"
    cost_per_unit_turnover = (fee_bps + slippage_bps) / 10_000.0

    strat_returns: list[float] = []
    equity = [1.0]
    wins = trades = 0
    prev_pos = 0

    for t in range(1, len(bars)):
        bar_ret = bars[t].close / bars[t - 1].close - 1.0
        pos = signals[t - 1]  # position held coming into bar t was decided at t-1
        turnover = abs(pos - prev_pos)
        if turnover > 0:
            trades += 1
        r = pos * bar_ret - cost_per_unit_turnover * turnover
        strat_returns.append(r)
        equity.append(equity[-1] * (1.0 + r))
        if pos != 0 and r > 0:
            wins += 1
        prev_pos = pos

    total_return = equity[-1] - 1.0
    years = max(len(strat_returns) / periods_per_year, 1e-9)
    cagr = (equity[-1] ** (1.0 / years) - 1.0) if equity[-1] > 0 else -1.0
    nonzero = sum(1 for s in signals if s != 0)
    return BacktestResult(
        n_bars=len(bars),
        n_trades=trades,
        total_return=total_return,
        cagr=cagr,
        sharpe=stats.sharpe(strat_returns, periods_per_year),
        max_drawdown=stats.max_drawdown(equity),
        hit_rate=(wins / nonzero) if nonzero else 0.0,
        returns=strat_returns,
        equity=equity,
    )
