"""Statistics helpers — pure stdlib (no numpy/scipy).

The point of this module is the *overfitting-aware* metrics. A naive Sharpe is
the number that lets retail quants fool themselves. The honest gate is the
Probabilistic Sharpe Ratio and a multiple-testing (deflated) benchmark.
"""
from __future__ import annotations

import math


def mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def stdev(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def skew(xs: list[float]) -> float:
    n = len(xs)
    if n < 3:
        return 0.0
    m, s = mean(xs), stdev(xs)
    if s == 0:
        return 0.0
    return (n / ((n - 1) * (n - 2))) * sum(((x - m) / s) ** 3 for x in xs)


def kurtosis(xs: list[float]) -> float:
    """Non-excess kurtosis (normal == 3)."""
    n = len(xs)
    if n < 4:
        return 3.0
    m, s = mean(xs), stdev(xs)
    if s == 0:
        return 3.0
    return sum(((x - m) / s) ** 4 for x in xs) / n


def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def norm_ppf(p: float) -> float:
    """Inverse normal CDF — Acklam's rational approximation."""
    if p <= 0.0:
        return -math.inf
    if p >= 1.0:
        return math.inf
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
         3.754408661907416e+00]
    plow, phigh = 0.02425, 1 - 0.02425
    if p < plow:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p > phigh:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    q = p - 0.5
    r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / \
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


def sharpe(returns: list[float], periods_per_year: float) -> float:
    """Annualized Sharpe from per-bar returns (rf=0)."""
    s = stdev(returns)
    if s == 0:
        return 0.0
    return (mean(returns) / s) * math.sqrt(periods_per_year)


def max_drawdown(equity: list[float]) -> float:
    """Largest peak-to-trough fraction (0..1). 0.2 == 20% drawdown."""
    peak = -math.inf
    mdd = 0.0
    for v in equity:
        peak = max(peak, v)
        if peak > 0:
            mdd = max(mdd, (peak - v) / peak)
    return mdd


def probabilistic_sharpe(returns: list[float], sr_benchmark_annual: float,
                         periods_per_year: float) -> float:
    """PSR — probability the *true* Sharpe exceeds a benchmark, given the
    estimate's standard error, skew, and fat tails (Bailey & López de Prado).

    Returns a probability in [0,1]. A strategy whose PSR against 0 is only 0.6
    is not statistically distinguishable from noise.
    """
    n = len(returns)
    if n < 8 or stdev(returns) == 0:
        return 0.0
    sr_per_bar = mean(returns) / stdev(returns)
    sr_bm_per_bar = sr_benchmark_annual / math.sqrt(periods_per_year)
    g3 = skew(returns)
    g4 = kurtosis(returns)
    denom = math.sqrt(max(1e-12, 1 - g3 * sr_per_bar + ((g4 - 1) / 4.0) * sr_per_bar ** 2))
    z = (sr_per_bar - sr_bm_per_bar) * math.sqrt(n - 1) / denom
    return norm_cdf(z)


def deflated_benchmark_sharpe(n_obs: int, n_trials: int, periods_per_year: float) -> float:
    """Expected MAXIMUM annualized Sharpe under the null (true SR=0) across
    ``n_trials`` independent backtests. Beating this is the bar for "not just
    the best of many random tries."

    Approximation: max of n_trials iid N(0, sigma) ~ sigma*sqrt(2*ln(n_trials)),
    where sigma (per-bar SR standard error under null) ~ 1/sqrt(n_obs).
    """
    if n_trials <= 1 or n_obs < 2:
        return 0.0
    sigma_per_bar = 1.0 / math.sqrt(n_obs)
    expected_max_per_bar = sigma_per_bar * math.sqrt(2.0 * math.log(n_trials))
    return expected_max_per_bar * math.sqrt(periods_per_year)
