"""Stage 2 — Signal generation (the MAKER).

A small registry of EXAMPLE hypotheses, not alpha. Each returns a raw long/flat
signal (0/1) from daily closes with NO look-ahead (the signal at bar t uses only
data up to and including t, then is applied to the t -> t+1 return). The optional
volatility-targeting overlay then scales any of them.

Strategies (select with --strategy):
  donchian — breakout: long on a new N-bar high, flat on a new N-bar low (trend)
  tsmom    — time-series momentum: long when price > its R-bar average (trend)
  meanrev  — short-term mean reversion: long when oversold, exit at the mean
  regime   — trend filtered by a calm-volatility regime (conditional trend)

Each carries a SMALL parameter grid on purpose — every knob is a degree of
freedom the verifier punishes via the deflated-Sharpe benchmark.
"""
from __future__ import annotations

import math

from .data import Bar
from . import stats


# ---- raw signal functions (each returns list[int] of 0/1) -----------------

def _donchian(bars: list[Bar], p: dict) -> list[int]:
    """Long on a break above the prior entry-window high; flat on a break below
    the prior exit-window low. (With close-only data, channels are close-based.)"""
    entry_n, exit_n = int(p["entry_lookback"]), int(p["exit_lookback"])
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    closes = [b.close for b in bars]
    pos, out = 0, []
    for t in range(len(bars)):
        if t < entry_n:
            out.append(0)
            continue
        entry_hi = max(highs[t - entry_n:t])
        exit_lo = min(lows[t - exit_n:t]) if t >= exit_n else lows[0]
        price = closes[t]
        if pos == 0 and price > entry_hi:
            pos = 1
        elif pos == 1 and price < exit_lo:
            pos = 0
        out.append(pos)
    return out


def _tsmom(bars: list[Bar], p: dict) -> list[int]:
    """Time-series momentum: long when price is above its trailing R-bar mean."""
    R = int(p["lookback"])
    closes = [b.close for b in bars]
    out = []
    for t in range(len(bars)):
        if t < R:
            out.append(0)
            continue
        sma = sum(closes[t - R:t]) / R  # prior R closes, excludes t
        out.append(1 if closes[t] > sma else 0)
    return out


def _meanrev(bars: list[Bar], p: dict) -> list[int]:
    """Short-term mean reversion: go long when the close is `entry_z` standard
    deviations BELOW its short mean (oversold); exit once it reverts to the mean."""
    w, entry_z = int(p["window"]), float(p["entry_z"])
    closes = [b.close for b in bars]
    pos, out = 0, []
    for t in range(len(bars)):
        if t < w:
            out.append(0)
            continue
        window = closes[t - w:t]  # prior w closes
        m, sd = stats.mean(window), stats.stdev(window)
        if sd <= 0:
            out.append(pos)
            continue
        z = (closes[t] - m) / sd
        if pos == 0 and z < -entry_z:
            pos = 1
        elif pos == 1 and z >= 0.0:
            pos = 0
        out.append(pos)
    return out


def _mvrv(bars: list[Bar], p: dict) -> list[int]:
    """On-chain valuation timing (ORTHOGONAL to price trend). MVRV = market value
    / realized value = how far the price sits above the network's aggregate cost
    basis. Historically a mean-reverting oscillator: cheap near bottoms, euphoric
    near tops. Contrarian rule, adaptive to regime:

      long  when MVRV falls below `entry_k` x its trailing median (undervalued)
      exit  when MVRV rises above `exit_k`  x its trailing median (overvalued)

    Requires bars to carry features['mvrv'] (Coin Metrics CapMVRVCur). If the
    feature is absent (e.g. synthetic data), the strategy stays flat."""
    look = int(p["mvrv_lookback"])
    entry_k, exit_k = float(p["entry_k"]), float(p["exit_k"])
    mvrv = [b.features.get("mvrv") for b in bars]
    pos, out = 0, []
    for t in range(len(bars)):
        window = [m for m in mvrv[max(0, t - look):t] if m is not None]
        if mvrv[t] is None or len(window) < max(30, look // 4):
            out.append(pos if mvrv[t] is not None else 0)
            continue
        med = stats.median(window)
        if med <= 0:
            out.append(pos)
            continue
        if pos == 0 and mvrv[t] < entry_k * med:
            pos = 1
        elif pos == 1 and mvrv[t] > exit_k * med:
            pos = 0
        out.append(pos)
    return out


def _regime(bars: list[Bar], p: dict) -> list[int]:
    """Trend, gated by a calm-volatility regime: long only when price is above its
    long SMA AND short-horizon realized vol is below its longer-horizon level."""
    trend_n, vol_n = int(p["trend_lookback"]), int(p["vol_regime_lookback"])
    long_vol_n = vol_n * 4
    closes = [b.close for b in bars]
    rets = [0.0] + [closes[i] / closes[i - 1] - 1.0 for i in range(1, len(closes))]
    need = max(trend_n, long_vol_n) + 1
    out = []
    for t in range(len(bars)):
        if t < need:
            out.append(0)
            continue
        sma = sum(closes[t - trend_n:t]) / trend_n
        short_vol = stats.stdev(rets[t - vol_n:t])
        long_vol = stats.stdev(rets[t - long_vol_n:t])
        out.append(1 if (closes[t] > sma and short_vol < long_vol) else 0)
    return out


def _trendval(bars: list[Bar], p: dict) -> list[int]:
    """Trend + calm-vol regime, PLUS an on-chain euphoria brake: step aside when
    MVRV is above `mvrv_ceiling` (network euphorically overvalued = top risk). The
    idea is to use genuinely orthogonal on-chain information to sidestep the big
    drawdowns that pure price trend cannot see coming. If MVRV is missing, the
    brake simply does not fire (degrades to plain regime trend)."""
    trend_n, vol_n = int(p["trend_lookback"]), int(p["vol_regime_lookback"])
    ceil = float(p["mvrv_ceiling"])
    long_vol_n = vol_n * 4
    closes = [b.close for b in bars]
    mvrv = [b.features.get("mvrv") for b in bars]
    rets = [0.0] + [closes[i] / closes[i - 1] - 1.0 for i in range(1, len(closes))]
    need = max(trend_n, long_vol_n) + 1
    out = []
    for t in range(len(bars)):
        if t < need:
            out.append(0)
            continue
        sma = sum(closes[t - trend_n:t]) / trend_n
        short_vol = stats.stdev(rets[t - vol_n:t])
        long_vol = stats.stdev(rets[t - long_vol_n:t])
        not_euphoric = (mvrv[t] is None) or (mvrv[t] < ceil)
        out.append(1 if (closes[t] > sma and short_vol < long_vol and not_euphoric) else 0)
    return out


# ---- registry -------------------------------------------------------------

STRATEGIES = {
    "donchian": {"fn": _donchian,
                 "params": {"entry_lookback": 55, "exit_lookback": 20},
                 "grid": {"entry_lookback": [20, 30, 40, 55, 70, 90, 110],
                          "exit_lookback": [10, 15, 20, 30, 40]}},
    "tsmom": {"fn": _tsmom,
              "params": {"lookback": 90},
              "grid": {"lookback": [30, 60, 90, 120]}},
    "meanrev": {"fn": _meanrev,
                "params": {"window": 10, "entry_z": 1.5},
                "grid": {"window": [5, 10, 20], "entry_z": [1.0, 1.5, 2.0]}},
    "regime": {"fn": _regime,
               "params": {"trend_lookback": 100, "vol_regime_lookback": 30},
               "grid": {"trend_lookback": [50, 100, 200], "vol_regime_lookback": [30, 60]}},
    "mvrv": {"fn": _mvrv,
             "params": {"mvrv_lookback": 365, "entry_k": 0.8, "exit_k": 1.5},
             "grid": {"mvrv_lookback": [180, 365], "entry_k": [0.8, 0.9], "exit_k": [1.3, 1.6]}},
    "trendval": {"fn": _trendval,
                 "params": {"trend_lookback": 100, "vol_regime_lookback": 30, "mvrv_ceiling": 3.0},
                 "grid": {"trend_lookback": [50, 100, 200], "vol_regime_lookback": [30, 60],
                          "mvrv_ceiling": [2.5, 3.5]}},
}

STRATEGY_NAMES = list(STRATEGIES)

# Back-compat: bare DEFAULT_PARAMS / DEFAULT_GRID refer to the donchian baseline.
DEFAULT_PARAMS = dict(STRATEGIES["donchian"]["params"])

DEFAULT_VOL_TARGET = {"target_vol": 0.40, "vol_lookback": 30, "max_leverage": 1.0}


def strategy_grid(name: str) -> dict:
    return STRATEGIES[name]["grid"]


def default_params(name: str) -> dict:
    return dict(STRATEGIES[name]["params"])


def generate_signals(bars: list[Bar], params: dict | None = None, *,
                     periods_per_year: float = 365) -> list:
    """Dispatch to the selected strategy (params["strategy"], default donchian),
    then apply the volatility-targeting overlay if params["vol_target"] is set.

    Without vol targeting: ints (0/1). With it: floats in [0, max_leverage].
    signals[t] is the position to HOLD over the next bar.
    """
    name = (params or {}).get("strategy", "donchian")
    p = {**STRATEGIES[name]["params"], **(params or {})}
    raw = STRATEGIES[name]["fn"](bars, p)

    if not p.get("vol_target"):
        return raw

    target = float(p.get("target_vol", DEFAULT_VOL_TARGET["target_vol"]))
    vlb = int(p.get("vol_lookback", DEFAULT_VOL_TARGET["vol_lookback"]))
    max_lev = float(p.get("max_leverage", DEFAULT_VOL_TARGET["max_leverage"]))
    target_per_bar = target / math.sqrt(periods_per_year)
    closes = [b.close for b in bars]

    out: list[float] = []
    for t in range(len(bars)):
        if raw[t] == 0:
            out.append(0.0)
            continue
        window = closes[max(0, t - vlb):t + 1]
        if len(window) < 3:
            out.append(0.0)
            continue
        rets = [window[i] / window[i - 1] - 1.0 for i in range(1, len(window))]
        sd = stats.stdev(rets)
        if sd <= 0:
            out.append(0.0)
            continue
        out.append(round(min(max_lev, target_per_bar / sd), 4))
    return out
