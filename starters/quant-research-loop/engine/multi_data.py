"""Multi-asset data panel for cross-sectional strategies.

Reuses data.from_coinmetrics (ranged/chunked fetch) per asset, then aligns every
asset onto one daily date axis. Missing cells are None (an asset that did not
exist yet, or a gap).

SURVIVORSHIP BIAS WARNING. This universe is a hand-picked set of assets that still
exist and still publish data in 2026. Every dead coin, every -99% rug, every
delisted token is silently absent. Cross-sectional crypto momentum backtests are
badly flattered by this — a real strategy would also have bought some of the
losers. Treat any positive result here as an UPPER bound, and read the caveat in
the README. This is exactly the kind of bias the forward test cannot fix (it is
baked into the universe, not the time split).
"""
from __future__ import annotations

import csv

from . import data as data_mod


DEFAULT_UNIVERSE = ["btc", "eth", "ltc", "xrp", "bch", "doge",
                    "xlm", "xmr", "etc", "ada", "link", "trx"]


def fetch_panel(assets: list[str] | None = None) -> tuple[list[int], dict[str, dict[int, float]]]:
    """Returns (dates, series) where series[asset] = {ts: price}."""
    assets = assets or DEFAULT_UNIVERSE
    series: dict[str, dict[int, float]] = {}
    for a in assets:
        bars = data_mod.from_coinmetrics(asset=a)
        series[a] = {b.ts: b.close for b in bars}
    all_dates = sorted(set().union(*[set(s) for s in series.values()]))
    return all_dates, series


def panel_to_csv(dates: list[int], series: dict[str, dict[int, float]],
                 assets: list[str], path: str) -> None:
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ts", *assets])
        for ts in dates:
            w.writerow([ts, *[series[a].get(ts, "") for a in assets]])


def panel_from_csv(path: str) -> tuple[list[int], dict[str, dict[int, float]], list[str]]:
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        assets = header[1:]
        series: dict[str, dict[int, float]] = {a: {} for a in assets}
        dates: list[int] = []
        for row in reader:
            ts = int(float(row[0]))
            dates.append(ts)
            for a, cell in zip(assets, row[1:]):
                if cell not in ("", None):
                    try:
                        series[a][ts] = float(cell)
                    except ValueError:
                        pass
    dates.sort()
    return dates, series, assets


def as_matrix(dates: list[int], series: dict[str, dict[int, float]],
              assets: list[str]) -> dict[str, list]:
    """Aligned price columns (None where missing), keyed by asset."""
    return {a: [series[a].get(ts) for ts in dates] for a in assets}
