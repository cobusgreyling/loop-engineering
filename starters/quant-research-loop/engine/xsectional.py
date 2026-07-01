"""Cross-sectional momentum — the first MULTI-asset hypothesis.

Idea (well documented across equities, futures, and crypto): assets that have
outperformed their peers recently keep outperforming over the medium term. Each
rebalance, rank the eligible universe by trailing return, hold the top-K equally
weighted, repeat. This is orthogonal to "is BTC up" — it is a bet on *relative*
strength, and it can make money in a flat market and lose in a rising one.

Honesty built in:
- No look-ahead: the holding set for day t is chosen from data up to day t-1.
- Costs charged on rebalance turnover.
- The SAME gauntlet as the single-asset engine: enforced trial counting, K-of-N
  walk-forward, deflated Sharpe, PSR, drawdown cap, and a forward-quarantine
  holdout the search never sees.
- Survivorship bias is real and unfixable here — see multi_data.py. Positive
  results are an upper bound.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import product

from . import stats


DEFAULT_GRID = {"lookback": [30, 60, 90], "top_k": [3, 5], "rebalance": [7, 30]}
DEFAULT_PARAMS = {"lookback": 90, "top_k": 3, "rebalance": 30, "skip": 0}


def _trailing_return(col: list, t: int, lookback: int, skip: int):
    """Return over [t-lookback, t-skip], using only info up to t. None if data
    is missing at either end."""
    a, b = t - lookback, t - skip
    if a < 0 or b < 0 or col[a] is None or col[b] is None or col[a] <= 0:
        return None
    return col[b] / col[a] - 1.0


def portfolio_returns(dates: list[int], cols: dict[str, list], params: dict,
                      *, fee_bps: float = 10.0, slippage_bps: float = 10.0) -> list[float]:
    """Daily portfolio return series for a long-only, equal-weight, top-K
    cross-sectional momentum rule. Costs applied when the holding set changes."""
    lookback = int(params["lookback"])
    top_k = int(params["top_k"])
    rebalance = int(params["rebalance"])
    skip = int(params.get("skip", 0))
    cost = (fee_bps + slippage_bps) / 10_000.0
    assets = list(cols)
    T = len(dates)

    long_short = bool(params.get("long_short"))

    def _leg_return(members: set, t: int) -> float:
        day = []
        for a in members:
            p0, p1 = cols[a][t - 1], cols[a][t]
            if p0 is not None and p1 is not None and p0 > 0:
                day.append(p1 / p0 - 1.0)
        return (sum(day) / len(day)) if day else 0.0

    held_long: set[str] = set()
    held_short: set[str] = set()
    rets: list[float] = []
    for t in range(1, T):
        # Rebalance decision uses data through t-1 (no look-ahead).
        if (t - 1) % rebalance == 0:
            ranks = []
            for a in assets:
                r = _trailing_return(cols[a], t - 1, lookback, skip)
                if r is not None and cols[a][t - 1] is not None:
                    ranks.append((r, a))
            ranks.sort(reverse=True)
            new_long = {a for _, a in ranks[:top_k]} if len(ranks) >= top_k else set()
            # Market-neutral: short the weakest top_k. Requires a disjoint bottom.
            new_short = ({a for _, a in ranks[-top_k:]}
                         if long_short and len(ranks) >= 2 * top_k else set())
            legs = top_k * (2 if long_short else 1)
            turnover = (len(new_long.symmetric_difference(held_long))
                        + len(new_short.symmetric_difference(held_short))) / max(1, legs)
            held_long, held_short = new_long, new_short
        else:
            turnover = 0.0

        # Long leg minus short leg (dollar-neutral spread when long_short).
        r = _leg_return(held_long, t) - (_leg_return(held_short, t) if long_short else 0.0)
        rets.append(r - cost * turnover)

    # Market-trend risk-off: flatten to cash when the market proxy (default BTC)
    # is below its trend SMA. Crypto sells off together, so exiting in aggregate
    # downtrends is the honest way to cut the drawdown the toxic short leg could
    # not. Decision at date i uses only data up to i (no look-ahead).
    if params.get("market_filter"):
        n = int(params.get("market_trend_n", 100))
        mkt = cols.get(params.get("market_proxy", "btc"))
        masked = []
        for i in range(len(rets)):
            ok = 1
            if mkt is not None and mkt[i] is not None:
                hist = [mkt[k] for k in range(max(0, i - n), i) if mkt[k] is not None]
                if len(hist) >= max(20, n // 2):
                    ok = 1 if mkt[i] > sum(hist) / len(hist) else 0
            masked.append(rets[i] * ok)
        rets = masked

    if not params.get("vol_target"):
        return rets

    # Portfolio-level volatility targeting: scale daily exposure by
    # target_vol / trailing realized portfolio vol (causal — uses returns before
    # t). A top-K alt basket runs at ~100%+ annualized vol, so a 50% target
    # shrinks exposure hard in turmoil, attacking the drawdown that sinks the raw
    # version. max_leverage caps it (1.0 = no borrow).
    target = float(params.get("target_vol", 0.50))
    vlb = int(params.get("vol_lookback", 30))
    max_lev = float(params.get("max_leverage", 1.0))
    tpb = target / math.sqrt(365)
    scaled: list[float] = []
    for t in range(len(rets)):
        window = rets[max(0, t - vlb):t]  # strictly before t
        if len(window) < 5:
            scaled.append(0.0)
            continue
        sd = stats.stdev(window)
        scaled.append(rets[t] if sd <= 0 else min(max_lev, tpb / sd) * rets[t])
    return scaled


def _equity(rets: list[float]) -> list[float]:
    eq = [1.0]
    for r in rets:
        eq.append(eq[-1] * (1.0 + r))
    return eq


def metrics(rets: list[float], ppy: float = 365) -> dict:
    eq = _equity(rets)
    return {
        "sharpe": round(stats.sharpe(rets, ppy), 3),
        "max_drawdown": round(stats.max_drawdown(eq), 4),
        "total_return": round(eq[-1] - 1.0, 4),
        "psr": round(stats.probabilistic_sharpe(rets, 0.0, ppy), 3),
    }


def expand_grid(grid: dict) -> list[dict]:
    keys = list(grid)
    return [dict(zip(keys, c)) for c in product(*[grid[k] for k in keys])]


@dataclass
class XFold:
    index: int
    params: dict
    is_sharpe: float
    oos_sharpe: float
    oos_max_drawdown: float
    passed: bool


@dataclass
class XResult:
    folds: list[XFold]
    passes: int
    k_required: int
    consistency_pass: bool
    aggregate_sharpe: float
    aggregate_psr: float
    aggregate_max_drawdown: float
    deflated_benchmark: float
    aggregate_pass: bool
    passed: bool
    trials: int
    max_dd_cap: float = 0.40

    def reasons(self) -> list[str]:
        return [
            f"{'PASS' if self.consistency_pass else 'FAIL'} · consistency: "
            f"{self.passes}/{len(self.folds)} folds (need {self.k_required})",
            f"{'PASS' if self.aggregate_sharpe > self.deflated_benchmark else 'FAIL'} · "
            f"deflated_sharpe: {self.aggregate_sharpe:.2f} vs {self.deflated_benchmark:.2f} "
            f"(trials={self.trials})",
            f"{'PASS' if self.aggregate_psr >= 0.95 else 'FAIL'} · PSR: {self.aggregate_psr:.3f}",
            f"{'PASS' if self.aggregate_max_drawdown <= self.max_dd_cap else 'FAIL'} · "
            f"maxDD: {self.aggregate_max_drawdown:.2%} vs {self.max_dd_cap:.0%}",
        ]


def walk_forward(dates: list[int], cols: dict[str, list], *, n_folds: int = 5,
                 grid: dict | None = None, base_params: dict | None = None,
                 min_fold_sharpe: float = 0.5,
                 max_fold_drawdown: float = 0.50, min_aggregate_sharpe: float = 1.0,
                 max_aggregate_drawdown: float = 0.40, n_trials_so_far: int = 0,
                 fee_bps: float = 10.0, slippage_bps: float = 10.0,
                 ppy: float = 365) -> XResult:
    grid = grid or DEFAULT_GRID
    combos = [{**(base_params or {}), **c} for c in expand_grid(grid)]
    T = len(dates)
    fold = T // (n_folds + 1)
    k_required = (n_folds * 3 + 4) // 5
    folds: list[XFold] = []
    pooled: list[float] = []
    trials = 0
    for i in range(n_folds):
        oos_a = (i + 1) * fold
        oos_b = T if i == n_folds - 1 else oos_a + fold
        best, best_sh = None, -1e9
        for p in combos:
            trials += 1
            r_is = portfolio_returns(dates[:oos_a], {a: cols[a][:oos_a] for a in cols},
                                     p, fee_bps=fee_bps, slippage_bps=slippage_bps)
            sh = stats.sharpe(r_is, ppy)
            if sh > best_sh:
                best, best_sh = p, sh
        # score winner on the OOS fold
        seg_dates = dates[:oos_b]
        seg_cols = {a: cols[a][:oos_b] for a in cols}
        r_all = portfolio_returns(seg_dates, seg_cols, best,
                                  fee_bps=fee_bps, slippage_bps=slippage_bps)
        r_oos = r_all[oos_a - 1:]  # returns indexed from day 1
        m = metrics(r_oos, ppy)
        passed = m["sharpe"] >= min_fold_sharpe and m["max_drawdown"] <= max_fold_drawdown
        folds.append(XFold(i, best, round(best_sh, 3), m["sharpe"], m["max_drawdown"], passed))
        pooled.extend(r_oos)

    passes = sum(1 for f in folds if f.passed)
    agg_sh = stats.sharpe(pooled, ppy)
    agg_dd = stats.max_drawdown(_equity(pooled))
    psr = stats.probabilistic_sharpe(pooled, 0.0, ppy)
    cum = n_trials_so_far + trials
    deflated = stats.deflated_benchmark_sharpe(len(pooled), max(1, cum), ppy)
    agg_pass = (agg_sh >= min_aggregate_sharpe and agg_sh > deflated
                and psr >= 0.95 and agg_dd <= max_aggregate_drawdown)
    consistency = passes >= k_required
    return XResult(folds, passes, k_required, consistency, round(agg_sh, 3),
                   round(psr, 3), round(agg_dd, 4), round(deflated, 3),
                   agg_pass, consistency and agg_pass, trials,
                   max_dd_cap=max_aggregate_drawdown)
