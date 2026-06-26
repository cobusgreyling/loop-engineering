"""Stage 5 — Risk monitoring / kill switch.

A loop without a checkable stop condition fails quietly. This module is the
non-negotiable circuit breaker: it does not ask the agent whether things are
fine, it measures equity and acts.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import stats


@dataclass
class RiskVerdict:
    breached: bool
    reason: str
    drawdown: float


def check(equity_curve: list[float], *, max_drawdown: float = 0.10) -> RiskVerdict:
    """Trip the breaker if live (paper) equity draws down past the cap.

    This is independent of any backtest claim — it watches realized equity. The
    backtest can say Sharpe 3; if real equity bleeds past the cap, flatten.
    """
    if len(equity_curve) < 2:
        return RiskVerdict(False, "insufficient equity history", 0.0)
    dd = stats.max_drawdown(equity_curve)
    if dd > max_drawdown:
        return RiskVerdict(True, f"drawdown {dd:.2%} exceeded cap {max_drawdown:.0%}", dd)
    return RiskVerdict(False, f"drawdown {dd:.2%} within cap {max_drawdown:.0%}", dd)
