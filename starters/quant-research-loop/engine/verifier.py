"""Stage 3b — Verification (the CHECKER).

This is the part the viral article got wrong. Its "verifier" was an LLM asked to
*opine* on a backtest. But a backtest's failure mode is OVERFITTING, not faulty
reasoning — and you cannot separation-of-duties your way out of curve-fitting by
adding a second opinion. The maker/checker split only helps if the checker does
something the maker structurally cannot fake.

So here the checker is NUMERICAL and INDEPENDENT:

1. Out-of-sample split. The maker may have tuned on the in-sample window. The
   checker re-runs the *same* signals on a holdout the maker never optimized on,
   and judges on THAT.
2. Multiple-testing penalty. If you tried `n_trials` parameter sets, the best
   one's Sharpe is inflated. The checker requires the OOS Sharpe to beat the
   expected maximum Sharpe of that many random tries (deflated benchmark).
3. Probabilistic Sharpe. Requires the OOS Sharpe to be statistically
   distinguishable from zero given sample size, skew, and fat tails.
4. Hard risk gates. Max drawdown and minimum trade count.

An LLM can still *narrate* this verdict for humans — but it must not be allowed
to overturn the numbers. The numbers are the checker.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .data import Bar
from .strategy import generate_signals
from .backtest import run_backtest
from . import stats


@dataclass
class Gate:
    name: str
    passed: bool
    detail: str


@dataclass
class Verdict:
    passed: bool
    gates: list[Gate] = field(default_factory=list)
    oos_summary: dict | None = None
    is_summary: dict | None = None

    def reasons(self) -> list[str]:
        return [f"{'PASS' if g.passed else 'FAIL'} · {g.name}: {g.detail}" for g in self.gates]


def verify(bars: list[Bar], params: dict, *,
           n_trials: int = 1,
           oos_fraction: float = 0.35,
           min_oos_sharpe: float = 1.0,
           max_oos_drawdown: float = 0.25,
           min_trades: int = 10,
           min_psr: float = 0.95,
           fee_bps: float = 5.0, slippage_bps: float = 5.0,
           periods_per_year: float = 24 * 365) -> Verdict:
    """Re-run signals on a holdout the maker did not optimize on, then gate.

    ``n_trials`` is how many parameter sets the maker searched. Be honest about
    it — understating it is how people pass garbage. If the maker grid-searched
    200 combos, pass 200.
    """
    split = int(len(bars) * (1.0 - oos_fraction))
    is_bars, oos_bars = bars[:split], bars[split:]
    if len(oos_bars) < 30:
        return Verdict(passed=False, gates=[
            Gate("data", False, f"only {len(oos_bars)} OOS bars; need >= 30")
        ])

    # Same params, two disjoint windows. Maker tuned on IS; checker judges OOS.
    is_sig = generate_signals(is_bars, params)
    oos_sig = generate_signals(oos_bars, params)
    is_res = run_backtest(is_bars, is_sig, fee_bps=fee_bps,
                          slippage_bps=slippage_bps, periods_per_year=periods_per_year)
    oos_res = run_backtest(oos_bars, oos_sig, fee_bps=fee_bps,
                           slippage_bps=slippage_bps, periods_per_year=periods_per_year)

    deflated = stats.deflated_benchmark_sharpe(
        n_obs=len(oos_res.returns), n_trials=n_trials, periods_per_year=periods_per_year)
    psr = stats.probabilistic_sharpe(oos_res.returns, sr_benchmark_annual=0.0,
                                     periods_per_year=periods_per_year)

    gates = [
        Gate("oos_sharpe", oos_res.sharpe >= min_oos_sharpe,
             f"OOS Sharpe {oos_res.sharpe:.2f} vs floor {min_oos_sharpe}"),
        Gate("deflated_sharpe", oos_res.sharpe > deflated,
             f"OOS Sharpe {oos_res.sharpe:.2f} vs deflated benchmark "
             f"{deflated:.2f} (n_trials={n_trials})"),
        Gate("probabilistic_sharpe", psr >= min_psr,
             f"PSR(>0) {psr:.3f} vs floor {min_psr}"),
        Gate("max_drawdown", oos_res.max_drawdown <= max_oos_drawdown,
             f"OOS maxDD {oos_res.max_drawdown:.2%} vs cap {max_oos_drawdown:.0%}"),
        Gate("min_trades", oos_res.n_trades >= min_trades,
             f"{oos_res.n_trades} OOS trades vs floor {min_trades}"),
        Gate("is_oos_consistency",
             oos_res.sharpe >= 0.5 * is_res.sharpe if is_res.sharpe > 0 else oos_res.sharpe > 0,
             f"OOS Sharpe {oos_res.sharpe:.2f} vs IS Sharpe {is_res.sharpe:.2f} "
             f"(degradation guard)"),
    ]

    return Verdict(
        passed=all(g.passed for g in gates),
        gates=gates,
        oos_summary=oos_res.summary(),
        is_summary=is_res.summary(),
    )
