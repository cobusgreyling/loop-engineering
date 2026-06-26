"""Stage 2 — Signal generation (the MAKER).

This is an EXAMPLE hypothesis, not alpha. It is a Donchian-channel breakout: go
long when price breaks the N-bar high, flat when it breaks the N-bar low. It is
here so the loop has something to test — it is the kind of simple, transparent
rule you should start from and then try (and usually fail) to beat.

Honest notes baked in:
- The signal at bar t uses ONLY information available up to and including bar t,
  then is applied to the t -> t+1 return in the backtest. No look-ahead.
- `params` are the knobs an over-eager optimizer will torture until the backtest
  looks great in-sample. The verifier exists precisely to punish that.
"""
from __future__ import annotations

from .data import Bar


DEFAULT_PARAMS = {"entry_lookback": 55, "exit_lookback": 20}


def generate_signals(bars: list[Bar], params: dict | None = None) -> list[int]:
    """Return a target position per bar: 1 = long, 0 = flat. (No shorting in the
    example — keep the first hypothesis boring.)

    signals[t] is the position you intend to HOLD over the next bar.
    """
    p = {**DEFAULT_PARAMS, **(params or {})}
    entry_n = int(p["entry_lookback"])
    exit_n = int(p["exit_lookback"])
    highs = [b.high for b in bars]
    lows = [b.low for b in bars]
    closes = [b.close for b in bars]

    pos = 0
    out: list[int] = []
    for t in range(len(bars)):
        if t < entry_n:
            out.append(0)
            continue
        # Channels formed from the *prior* window only (exclude current bar).
        entry_hi = max(highs[t - entry_n:t])
        exit_lo = min(lows[t - exit_n:t]) if t >= exit_n else lows[0]
        price = closes[t]
        if pos == 0 and price > entry_hi:
            pos = 1
        elif pos == 1 and price < exit_lo:
            pos = 0
        out.append(pos)
    return out
