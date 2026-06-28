"""#5 — Forward paper-trade quarantine.

Every test so far reuses historical data. Manual experimentation (sweeping
target_vol, re-running with new seeds) leaks selection bias the enforced counter
cannot see. The one judge that cannot be gamed by any amount of fiddling is data
that did not exist when the research was done.

So: carve the most-recent slice of history into a QUARANTINE window that the
search, walk-forward, and lockbox never touch. A strategy that survives research
is "registered" against that window and forward-tested on it exactly once. Its
forward performance — not any backtest — is the verdict that gates capital.

Two honesty rules, mirroring the lockbox:
- The forward window is downstream in time of all research data (no look-back).
- Each strategy forward-tested on a given window spends a bit of its power; the
  ledger caps how many strategies may touch one window (`max_evals`). Past that,
  the window is spent — get genuinely new forward data (in a live loop, wait for
  real time to pass).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .data import Bar
from .strategy import generate_signals
from .backtest import run_backtest
from .ledger import ResearchLedger, fingerprint
from . import stats


@dataclass
class ForwardResult:
    passed: bool
    blocked: bool
    reason: str
    fingerprint: str
    forward_bars: int
    enough_data: bool
    research_sharpe: float
    forward_sharpe: float
    forward_return: float
    forward_max_drawdown: float
    forward_trades: int
    gates: list = field(default_factory=list)

    def reasons(self) -> list[str]:
        if self.blocked:
            return [f"BLOCKED · {self.reason}"]
        return [f"{'PASS' if ok else 'FAIL'} · {name}: {detail}"
                for name, ok, detail in self.gates]

    def summary(self) -> dict:
        return {
            "passed": self.passed, "blocked": self.blocked,
            "forward_bars": self.forward_bars, "enough_data": self.enough_data,
            "research_sharpe": self.research_sharpe, "forward_sharpe": self.forward_sharpe,
            "forward_return": round(self.forward_return, 4),
            "forward_max_drawdown": round(self.forward_max_drawdown, 4),
            "forward_trades": self.forward_trades,
        }


def forward_test(forward_bars: list[Bar], params: dict, *, research_sharpe: float,
                 ledger: ResearchLedger, max_evals: int = 5,
                 min_forward_bars: int = 60, min_forward_sharpe: float = 0.5,
                 max_forward_drawdown: float = 0.30, degradation_floor: float = 0.5,
                 fee_bps: float = 5.0, slippage_bps: float = 5.0,
                 periods_per_year: float = 365, record: bool = True) -> ForwardResult:
    """Paper-trade `params` over the untouched forward window and gate on the
    REALIZED forward result, not the backtest claim."""
    fp = fingerprint(forward_bars)
    if not ledger.quarantine_can_test(fp, max_evals):
        n = ledger.quarantine_count(fp)
        return ForwardResult(
            passed=False, blocked=True,
            reason=(f"forward window {fp} already tested {n}/{max_evals} times — "
                    f"it is spent. Wait for genuinely new forward data."),
            fingerprint=fp, forward_bars=len(forward_bars), enough_data=False,
            research_sharpe=research_sharpe, forward_sharpe=0.0, forward_return=0.0,
            forward_max_drawdown=0.0, forward_trades=0)

    enough = len(forward_bars) >= min_forward_bars
    res = run_backtest(forward_bars, generate_signals(forward_bars, params, periods_per_year=periods_per_year),
                       fee_bps=fee_bps, slippage_bps=slippage_bps, periods_per_year=periods_per_year)

    # Does forward hold up vs what research promised? (Some decay is normal; a
    # collapse is the tell.)
    degraded_ok = (res.sharpe >= degradation_floor * research_sharpe
                   if research_sharpe > 0 else res.sharpe > 0)
    gates = [
        ("enough_forward_data", enough,
         f"{len(forward_bars)} forward bars vs floor {min_forward_bars}"),
        ("forward_sharpe", res.sharpe >= min_forward_sharpe,
         f"forward Sharpe {res.sharpe:.2f} vs floor {min_forward_sharpe}"),
        ("forward_drawdown", res.max_drawdown <= max_forward_drawdown,
         f"forward maxDD {res.max_drawdown:.2%} vs cap {max_forward_drawdown:.0%}"),
        ("no_collapse_vs_research", degraded_ok,
         f"forward Sharpe {res.sharpe:.2f} vs research {research_sharpe:.2f} "
         f"(floor {degradation_floor:.0%})"),
    ]
    passed = enough and all(ok for _, ok, _ in gates)
    if record:
        ledger.record_quarantine(fp, {
            "params": params, "forward_sharpe": round(res.sharpe, 3),
            "passed": passed,
        })
    return ForwardResult(
        passed=passed, blocked=False, reason="evaluated", fingerprint=fp,
        forward_bars=len(forward_bars), enough_data=enough,
        research_sharpe=round(research_sharpe, 3), forward_sharpe=round(res.sharpe, 3),
        forward_return=res.total_return, forward_max_drawdown=res.max_drawdown,
        forward_trades=res.n_trades, gates=gates)
