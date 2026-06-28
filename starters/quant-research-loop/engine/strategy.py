"""Stage 2 — Signal generation (the MAKER).

This is an EXAMPLE hypothesis, not alpha. It is a Donchian-channel breakout: go
long when price breaks the N-bar high, flat when it breaks the N-bar low. It is
here so the loop has something to test — it is the kind of simple, transparent
rule you should start from and then try (and usually fail) to beat.

Optional overlay: VOLATILITY TARGETING. The raw breakout holds a full position
whenever it is long, so its drawdown tracks the asset's own (brutal) drawdown.
Vol targeting instead sizes the position so that *expected* risk is roughly
constant: hold less when recent realized volatility is high (crashes, chop), more
when it is low — capped at `max_leverage`. This is the single most effective way
to turn a breakout that has real signal but ugly drawdowns into something that
might clear the walk-forward drawdown gate.

Honest notes baked in:
- The signal at bar t uses ONLY information available up to and including bar t,
  then is applied to the t -> t+1 return in the backtest. No look-ahead — realized
  vol at t is computed from returns ending at t.
- `params` are the knobs an over-eager optimizer will torture until the backtest
  looks great in-sample. The verifier exists precisely to punish that. Note that
  vol-target params (target_vol, vol_lookback) are principled defaults, NOT
  searched — adding searchable knobs would just hand the optimizer more rope.
"""
from __future__ import annotations

import math

from .data import Bar
from . import stats


DEFAULT_PARAMS = {"entry_lookback": 55, "exit_lookback": 20}

# Vol-targeting defaults (used only when params["vol_target"] is truthy).
# 40% annualized target suits crypto; max_leverage 1.0 keeps it spot-consistent
# (never borrow), so the overlay can only ever SHRINK the position, never lever up.
DEFAULT_VOL_TARGET = {"target_vol": 0.40, "vol_lookback": 30, "max_leverage": 1.0}


def generate_signals(bars: list[Bar], params: dict | None = None, *,
                     periods_per_year: float = 365) -> list:
    """Return a target position per bar.

    Without vol targeting: 1 = long, 0 = flat (ints, as before).
    With vol targeting (params["vol_target"] truthy): a float in [0, max_leverage]
    scaling the long position by target_vol / realized_vol.

    signals[t] is the position you intend to HOLD over the next bar.
    """
    p = {**DEFAULT_PARAMS, **(params or {})}
    entry_n = int(p["entry_lookback"])
    exit_n = int(p["exit_lookback"])
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    closes = [b.close for b in bars]

    pos = 0
    raw: list[int] = []
    for t in range(len(bars)):
        if t < entry_n:
            raw.append(0)
            continue
        # Channels formed from the *prior* window only (exclude current bar).
        entry_hi = max(highs[t - entry_n:t])
        exit_lo = min(lows[t - exit_n:t]) if t >= exit_n else lows[0]
        price = closes[t]
        if pos == 0 and price > entry_hi:
            pos = 1
        elif pos == 1 and price < exit_lo:
            pos = 0
        raw.append(pos)

    if not p.get("vol_target"):
        return raw

    target = float(p.get("target_vol", DEFAULT_VOL_TARGET["target_vol"]))
    vlb = int(p.get("vol_lookback", DEFAULT_VOL_TARGET["vol_lookback"]))
    max_lev = float(p.get("max_leverage", DEFAULT_VOL_TARGET["max_leverage"]))
    target_per_bar = target / math.sqrt(periods_per_year)

    out: list[float] = []
    for t in range(len(bars)):
        if raw[t] == 0:
            out.append(0.0)
            continue
        window = closes[max(0, t - vlb):t + 1]  # closes up to and including t
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
