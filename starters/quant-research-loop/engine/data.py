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

import calendar
import csv
import http.client
import io
import json
import math
import re
import urllib.request
from dataclasses import dataclass, asdict, field
from datetime import datetime


@dataclass
class Bar:
    ts: int  # unix seconds
    open: float
    high: float
    low: float
    close: float
    volume: float
    features: dict = field(default_factory=dict)  # optional on-chain columns (e.g. mvrv)


_STD_COLS = {"ts", "open", "high", "low", "close", "volume"}


def from_csv(path: str) -> list[Bar]:
    bars: list[Bar] = []
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            # Any non-standard column becomes a numeric feature (e.g. mvrv, adract).
            feats = {}
            for k, v in row.items():
                if k not in _STD_COLS and v not in (None, ""):
                    try:
                        feats[k] = float(v)
                    except ValueError:
                        pass
            bars.append(
                Bar(
                    ts=int(float(row["ts"])),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row.get("volume", 0) or 0),
                    features=feats,
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


def from_coinmetrics(asset: str = "btc", timeout: int = 120) -> list[Bar]:
    """Real DAILY price history from the Coin Metrics community dataset
    (raw.githubusercontent.com — a host this environment allows when exchange
    APIs are blocked).

    Coin Metrics publishes a daily reference price (``PriceUSD``), not OHLC, so we
    build close-only bars: open=high=low=close=PriceUSD. For a daily Donchian
    breakout that is the standard 'Donchian on close' variant — the channel is
    formed from closes. On your own machine, prefer Binance.US for true OHLCV.
    """
    url = f"https://raw.githubusercontent.com/coinmetrics/data/master/csv/{asset}.csv"

    def _range(start: int, end: int) -> tuple[bytes, int | None]:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0", "Range": f"bytes={start}-{end}"})
        r = urllib.request.urlopen(req, timeout=timeout)
        cr = r.headers.get("Content-Range", "")
        out = b""
        try:
            while True:
                c = r.read(65536)
                if not c:
                    break
                out += c
        except http.client.IncompleteRead as exc:
            out += exc.partial
        m = re.search(r"/(\d+)$", cr)
        return out, (int(m.group(1)) if m else None)

    # The egress proxy caps a single response (~0.5-1.3MB), truncating the full
    # ~2.5MB file. HTTP Range lets us fetch and stitch the whole history.
    _, total = _range(0, 1)
    if not total:  # server ignored Range — fall back to one (capped) GET
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=timeout)
        try:
            buf = resp.read()
        except http.client.IncompleteRead as exc:
            buf = exc.partial
    else:
        chunk, off, buf = 400_000, 0, b""
        while off < total:
            part, _ = _range(off, min(off + chunk - 1, total - 1))
            if not part:
                break
            buf += part
            off += len(part)

    rows = list(csv.reader(io.StringIO(buf.decode("utf-8", "replace"))))
    if not rows:
        return []
    hdr = rows[0]
    if len(rows[-1]) != len(hdr):  # drop a truncated final line
        rows = rows[:-1]
    if "time" not in hdr or "PriceUSD" not in hdr:
        return []  # some community assets lack a USD reference price — skip them
    ti, pi = hdr.index("time"), hdr.index("PriceUSD")
    # Optional on-chain features, mapped to short names. Absent columns are skipped.
    feat_cols = {"mvrv": "CapMVRVCur", "adract": "AdrActCnt", "txcnt": "TxCnt"}
    feat_idx = {name: hdr.index(col) for name, col in feat_cols.items() if col in hdr}
    bars: list[Bar] = []
    for r in rows[1:]:
        if len(r) <= pi or not r[pi]:
            continue
        ts = calendar.timegm(datetime.strptime(r[ti][:10], "%Y-%m-%d").timetuple())
        price = float(r[pi])
        feats = {}
        for name, ci in feat_idx.items():
            if len(r) > ci and r[ci]:
                try:
                    feats[name] = float(r[ci])
                except ValueError:
                    pass
        bars.append(Bar(ts=ts, open=price, high=price, low=price, close=price,
                        volume=0.0, features=feats))
    bars.sort(key=lambda b: b.ts)
    return bars


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
            return synthetic(n=limit, seed=seed), f"SYNTHETIC(live-failed:{type(exc).__name__})"
    if source == "coinmetrics":
        # Coin Metrics keys by bare asset ("btc"), not a pair — strip the quote.
        asset = symbol.lower()
        for q in ("usdt", "usdc", "usd"):
            if asset.endswith(q):
                asset = asset[: -len(q)]
                break
        try:
            bars = from_coinmetrics(asset=asset)
            return bars[-limit:] if limit else bars, f"coinmetrics:{asset}:daily-close"
        except Exception as exc:
            return synthetic(n=limit, seed=seed), f"SYNTHETIC(coinmetrics-failed:{type(exc).__name__})"
    return synthetic(n=limit, seed=seed), f"SYNTHETIC:seed={seed}"


def to_csv(bars: list[Bar], path: str) -> None:
    feat_keys = sorted({k for b in bars for k in b.features})
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ts", "open", "high", "low", "close", "volume", *feat_keys])
        for b in bars:
            w.writerow([b.ts, b.open, b.high, b.low, b.close, b.volume,
                        *[b.features.get(k, "") for k in feat_keys]])


def closes(bars: list[Bar]) -> list[float]:
    return [b.close for b in bars]


if __name__ == "__main__":
    bars, prov = get_ohlcv()
    print(f"{len(bars)} bars · provenance={prov}")
    print(json.dumps(asdict(bars[0]), indent=2))
    print(json.dumps(asdict(bars[-1]), indent=2))
