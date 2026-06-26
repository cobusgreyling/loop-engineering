"""Stage 1 — Data ingestion.

Pure stdlib. Three sources, in priority order:

1. A local CSV (``--csv path``) with columns: ts,open,high,low,close,volume
2. A live public REST pull (Binance klines) if ``--source live`` and network is up
3. A deterministic SYNTHETIC series (default) so the loop runs offline with no
   keys and no network. Synthetic data is reproducible from ``seed`` so a run is
   repeatable — important for honest backtests.

Synthetic data is clearly NOT real market data. It exists so you can exercise
the whole loop end to end before wiring a real feed. Do not draw conclusions
about a strategy from synthetic bars.
"""
from __future__ import annotations

import csv
import json
import math
import urllib.request
from dataclasses import dataclass, asdict


@dataclass
class Bar:
    ts: int  # unix seconds
    open: float
    high: float
    low: float
    close: float
    volume: float


def from_csv(path: str) -> list[Bar]:
    bars: list[Bar] = []
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            bars.append(
                Bar(
                    ts=int(float(row["ts"])),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row.get("volume", 0) or 0),
                )
            )
    bars.sort(key=lambda b: b.ts)
    return bars


def from_live(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 1000) -> list[Bar]:
    """Public Binance klines — no key required. May be blocked by your network."""
    url = (
        f"https://api.binance.com/api/v3/klines"
        f"?symbol={symbol}&interval={interval}&limit={min(limit, 1000)}"
    )
    with urllib.request.urlopen(url, timeout=15) as resp:
        rows = json.loads(resp.read().decode())
    return [
        Bar(
            ts=int(r[0] // 1000),
            open=float(r[1]),
            high=float(r[2]),
            low=float(r[3]),
            close=float(r[4]),
            volume=float(r[5]),
        )
        for r in rows
    ]


def synthetic(n: int = 1500, seed: int = 7, start: float = 30000.0,
              drift: float = 0.0001, vol: float = 0.02) -> list[Bar]:
    """Deterministic geometric-random-walk OHLC. Reproducible from seed.

    Uses a tiny LCG instead of `random` so output is identical across machines
    and Python versions — a backtest you cannot reproduce is not a backtest.
    """
    # Box-Muller on a deterministic LCG → standard normals.
    state = seed & 0xFFFFFFFF

    def _u() -> float:
        nonlocal state
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        return (state + 1) / 0x80000000

    def _z() -> float:
        u1, u2 = _u(), _u()
        return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)

    bars: list[Bar] = []
    price = start
    ts = 1_600_000_000  # fixed epoch start for reproducibility
    step = 3600
    for _ in range(n):
        ret = drift + vol * _z()
        new = max(price * (1.0 + ret), 0.01)
        o, c = price, new
        hi = max(o, c) * (1.0 + abs(vol * _z()) * 0.3)
        lo = min(o, c) * (1.0 - abs(vol * _z()) * 0.3)
        bars.append(Bar(ts=ts, open=o, high=hi, low=lo, close=c, volume=1000.0 + 500.0 * _u()))
        price = new
        ts += step
    return bars


def get_ohlcv(source: str = "synthetic", *, csv_path: str | None = None,
              symbol: str = "BTCUSDT", interval: str = "1h",
              limit: int = 1500, seed: int = 7) -> tuple[list[Bar], str]:
    """Returns (bars, provenance). Provenance is recorded in STATE for honesty."""
    if csv_path:
        return from_csv(csv_path), f"csv:{csv_path}"
    if source == "live":
        try:
            return from_live(symbol, interval, min(limit, 1000)), f"live:binance:{symbol}:{interval}"
        except Exception as exc:  # network blocked / rate limited → fall back loudly
            bars = synthetic(n=limit, seed=seed)
            return bars, f"SYNTHETIC(live-failed:{type(exc).__name__})"
    return synthetic(n=limit, seed=seed), f"SYNTHETIC:seed={seed}"


def closes(bars: list[Bar]) -> list[float]:
    return [b.close for b in bars]


if __name__ == "__main__":
    bars, prov = get_ohlcv()
    print(f"{len(bars)} bars · provenance={prov}")
    print(json.dumps(asdict(bars[0]), indent=2))
    print(json.dumps(asdict(bars[-1]), indent=2))
