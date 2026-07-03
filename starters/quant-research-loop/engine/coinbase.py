"""Coinbase Exchange public candles adapter — granular (hourly+) live prices.

Public endpoint, no API key required. Blocked in some sandboxes (exchange egress
policy) but works on open internet (Railway, your machine). Gives CURRENT data, so
it unblocks the forward tracker that the daily/lagging Coin Metrics feed cannot.

Coinbase candle row: [time, low, high, open, close, volume], time in unix seconds,
returned most-recent-first, max 300 per request — so we paginate backward.
"""
from __future__ import annotations

import json
import time
import urllib.request
from datetime import datetime

from .data import Bar


BASE = "https://api.exchange.coinbase.com"
GRANULARITY = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "6h": 21600, "1d": 86400}
MAX_PER_REQ = 300


def parse_candles(rows: list) -> list[Bar]:
    """Coinbase [time, low, high, open, close, volume] → sorted ascending Bars."""
    out = [Bar(ts=int(r[0]), open=float(r[3]), high=float(r[2]), low=float(r[1]),
               close=float(r[4]), volume=float(r[5])) for r in rows]
    out.sort(key=lambda b: b.ts)
    return out


def _iso(ts: int) -> str:
    return datetime.utcfromtimestamp(ts).isoformat()


def _fetch_page(product: str, gran: int, start: int, end: int, timeout: int = 20) -> list[Bar]:
    url = (f"{BASE}/products/{product}/candles?granularity={gran}"
           f"&start={_iso(start)}&end={_iso(end)}")
    req = urllib.request.Request(url, headers={"User-Agent": "quant-research-loop"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return parse_candles(json.loads(resp.read().decode()))


def fetch_candles(product: str = "BTC-USD", timeframe: str = "1h", limit: int = 2000,
                  now_ts: int | None = None, pause_s: float = 0.25) -> list[Bar]:
    """Fetch up to `limit` candles at `timeframe`, paginating backward from now.
    Returns Bars ascending by time. Deduplicates on timestamp."""
    if timeframe not in GRANULARITY:
        raise ValueError(f"timeframe must be one of {list(GRANULARITY)}")
    gran = GRANULARITY[timeframe]
    end = now_ts if now_ts is not None else int(datetime.utcnow().timestamp())
    by_ts: dict[int, Bar] = {}
    while len(by_ts) < limit:
        start = end - MAX_PER_REQ * gran
        page = _fetch_page(product, gran, start, end)
        if not page:
            break
        for b in page:
            by_ts[b.ts] = b
        end = page[0].ts - gran  # oldest bar returned, step back
        if len(page) < MAX_PER_REQ:
            break
        if pause_s:
            time.sleep(pause_s)  # be polite to the public endpoint
    bars = sorted(by_ts.values(), key=lambda b: b.ts)
    return bars[-limit:]


def to_daily(bars: list[Bar]) -> list[Bar]:
    """Resample intraday bars to daily (UTC): open=first, high=max, low=min,
    close=last, volume=sum. Lets daily strategies run off an hourly feed."""
    buckets: dict[str, list[Bar]] = {}
    for b in bars:
        day = datetime.utcfromtimestamp(b.ts).strftime("%Y-%m-%d")
        buckets.setdefault(day, []).append(b)
    out: list[Bar] = []
    for day in sorted(buckets):
        bs = sorted(buckets[day], key=lambda x: x.ts)
        midnight = int(datetime.strptime(day, "%Y-%m-%d").timestamp())
        out.append(Bar(ts=midnight, open=bs[0].open, high=max(x.high for x in bs),
                       low=min(x.low for x in bs), close=bs[-1].close,
                       volume=sum(x.volume for x in bs)))
    return out


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Fetch Coinbase candles (public, no key).")
    p.add_argument("--product", default="BTC-USD")
    p.add_argument("--timeframe", default="1h", choices=list(GRANULARITY))
    p.add_argument("--limit", type=int, default=500)
    p.add_argument("--daily", action="store_true", help="resample to daily bars")
    a = p.parse_args()
    bars = fetch_candles(a.product, a.timeframe, a.limit)
    if a.daily:
        bars = to_daily(bars)
    if bars:
        print(f"{len(bars)} bars · {datetime.utcfromtimestamp(bars[0].ts).date()} "
              f"→ {datetime.utcfromtimestamp(bars[-1].ts).date()}")
        b = bars[-1]
        print(f"latest: {datetime.utcfromtimestamp(b.ts)} O{b.open} H{b.high} L{b.low} C{b.close}")
    else:
        print("no bars returned")
