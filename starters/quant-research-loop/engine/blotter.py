"""Per-trade blotter (single-asset) — a magnifying glass on the equity curve.

The equity curve tells you IF a strategy is profitable. The blotter tells you
WHICH trades made or lost the money. It does not re-simulate anything: it slices
the exact daily returns the backtest already computes into discrete round-trips.

A "trade" is a contiguous span of non-zero exposure — entry when the position
goes from flat to on, exit when it returns to flat. Vol targeting means the size
varies within a span; the trade's PnL is the compounded daily contribution over
the whole span, net of entry/exit costs, so it is exact by construction (the
product of all trade growths reconciles to the backtest's final equity).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime

from .data import Bar
from . import stats


NOTIONAL = 10_000.0  # per-trade PnL is shown on a fixed stake, not the compounding account


@dataclass
class Trade:
    n: int
    entry_date: str
    exit_date: str
    holding_days: int
    entry_price: float
    exit_price: float
    avg_exposure: float
    price_return: float   # raw asset move over the hold
    net_return: float     # exposure-scaled, net of costs — what the trade added to equity
    pnl_usd: float        # net_return on a fixed $NOTIONAL stake
    status: str           # 'closed' | 'open'


def _d(ts: int) -> str:
    return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")


def extract_trades(bars: list[Bar], sig: list, *,
                   fee_bps: float = 5.0, slippage_bps: float = 5.0) -> list[Trade]:
    """Slice the position series into round-trips. `sig[t]` is the position held
    from bar t into bar t+1 (backtest convention); it may be fractional."""
    cost = (fee_bps + slippage_bps) / 10_000.0
    closes = [b.close for b in bars]
    n = len(bars)
    trades: list[Trade] = []
    cur = None
    prev_pos = 0.0
    count = 0

    for t in range(1, n):
        pos = float(sig[t - 1])            # held from bar t-1 into bar t
        bar_ret = closes[t] / closes[t - 1] - 1.0
        turnover = abs(pos - prev_pos)
        daily = pos * bar_ret - cost * turnover

        if pos > 0 and cur is None:        # entry: established at close[t-1]
            count += 1
            cur = {"n": count, "entry_idx": t - 1, "growth": 1.0, "exp": []}
        if cur is not None:
            cur["growth"] *= (1.0 + daily)
            if pos > 0:
                cur["exp"].append(pos)
        if pos == 0 and cur is not None:   # exit: flattened at close[t-1]
            trades.append(_finalize(cur, bars, closes, t - 1, "closed"))
            cur = None
        prev_pos = pos

    if cur is not None:                    # still exposed at the end → open trade
        trades.append(_finalize(cur, bars, closes, n - 1, "open"))
    return trades


def _finalize(cur: dict, bars, closes, exit_idx: int, status: str) -> Trade:
    ei = cur["entry_idx"]
    net = cur["growth"] - 1.0  # full precision — reconciles exactly to backtest equity
    return Trade(
        n=cur["n"], entry_date=_d(bars[ei].ts), exit_date=_d(bars[exit_idx].ts),
        holding_days=exit_idx - ei, entry_price=round(closes[ei], 2),
        exit_price=round(closes[exit_idx], 2),
        avg_exposure=round(sum(cur["exp"]) / len(cur["exp"]), 3) if cur["exp"] else 0.0,
        price_return=round(closes[exit_idx] / closes[ei] - 1.0, 4),
        net_return=net, pnl_usd=net * NOTIONAL, status=status)


def summarize(trades: list[Trade]) -> dict:
    closed = [t for t in trades if t.status == "closed"]
    if not closed:
        return {"n_trades": 0, "n_open": len(trades) - len(closed)}
    wins = [t for t in closed if t.net_return > 0]
    losses = [t for t in closed if t.net_return <= 0]
    gross_win = sum(t.net_return for t in wins)
    gross_loss = sum(t.net_return for t in losses)
    compounded = 1.0
    for t in closed:
        compounded *= (1.0 + t.net_return)
    return {
        "n_trades": len(closed),
        "n_open": len(trades) - len(closed),
        "win_rate": round(len(wins) / len(closed), 3),
        "avg_win": round(stats.mean([t.net_return for t in wins]), 4) if wins else 0.0,
        "avg_loss": round(stats.mean([t.net_return for t in losses]), 4) if losses else 0.0,
        "profit_factor": round(gross_win / abs(gross_loss), 2) if gross_loss else float("inf"),
        "expectancy": round(stats.mean([t.net_return for t in closed]), 4),
        "avg_holding_days": round(stats.mean([t.holding_days for t in closed]), 1),
        "best": round(max(t.net_return for t in closed), 4),
        "worst": round(min(t.net_return for t in closed), 4),
        "compounded_return": round(compounded - 1.0, 4),
    }


def filter_since(trades: list[Trade], since_date: str) -> list[Trade]:
    return [t for t in trades if t.entry_date >= since_date]


def format_md(trades: list[Trade], name: str, since: str | None = None) -> str:
    s = summarize(trades)
    out = [f"# Trade Blotter — {name}", ""]
    if since:
        out.append(f"_Trades entered on/after {since}._")
        out.append("")
    if s["n_trades"] == 0 and s.get("n_open", 0) == 0:
        return "\n".join(out + ["No trades."])
    out += [
        "| metric | value | metric | value |",
        "|--------|-------|--------|-------|",
        f"| trades (closed) | {s['n_trades']} | win rate | {s.get('win_rate',0):.0%} |",
        f"| profit factor | {s.get('profit_factor','—')} | expectancy | {s.get('expectancy',0):+.2%} |",
        f"| avg win | {s.get('avg_win',0):+.2%} | avg loss | {s.get('avg_loss',0):+.2%} |",
        f"| best | {s.get('best',0):+.1%} | worst | {s.get('worst',0):+.1%} |",
        f"| avg hold (days) | {s.get('avg_holding_days','—')} | open trades | {s.get('n_open',0)} |",
        "",
        "| # | entry | exit | days | entry $ | exit $ | avg exp | price Δ | net PnL | $ (10k) | status |",
        "|---|-------|------|------|---------|--------|---------|---------|---------|---------|--------|",
    ]
    for t in trades:
        out.append(
            f"| {t.n} | {t.entry_date} | {t.exit_date} | {t.holding_days} | "
            f"{t.entry_price:,.2f} | {t.exit_price:,.2f} | {t.avg_exposure:.2f} | "
            f"{t.price_return:+.1%} | {t.net_return:+.2%} | {t.pnl_usd:+,.0f} | {t.status} |")
    out.append("")
    out.append("_Per-trade PnL on a fixed $10k stake (not the compounding account); "
               "net of 10bps round-trip costs._")
    return "\n".join(out)


def xsec_summary(trades: list, total_costs: float) -> dict:
    """Roll-up for a per-coin (cross-sectional) blotter."""
    closed = [t for t in trades if t.status == "closed"]
    wins = [t for t in closed if t.contribution > 0]
    gross = sum(t.contribution for t in trades)
    return {
        "n_trades": len(closed), "n_open": len(trades) - len(closed),
        "win_rate": round(len(wins) / len(closed), 3) if closed else 0.0,
        "avg_holding_days": round(stats.mean([t.holding_days for t in closed]), 1) if closed else 0.0,
        "gross_contribution": round(gross, 4), "total_costs": round(total_costs, 4),
        "net": round(gross - total_costs, 4),
        "best_trade": round(max((t.contribution for t in trades), default=0.0), 4),
        "worst_trade": round(min((t.contribution for t in trades), default=0.0), 4),
    }


def coin_rollup(trades: list) -> list:
    """Aggregate contribution by coin (which coins made/lost the money)."""
    from collections import defaultdict
    agg = defaultdict(lambda: [0, 0.0])
    for t in trades:
        agg[t.coin][0] += 1
        agg[t.coin][1] += t.contribution
    rows = [(c, n, contrib) for c, (n, contrib) in agg.items()]
    rows.sort(key=lambda r: r[2], reverse=True)
    return rows


def format_xsec_md(trades: list, total_costs: float, name: str, since: str | None = None) -> str:
    s = xsec_summary(trades, total_costs)
    out = [f"# Trade Blotter — {name} (per-coin)", ""]
    if since:
        out += [f"_Coin-trades entered on/after {since}._", ""]
    out += [
        "| metric | value | metric | value |",
        "|--------|-------|--------|-------|",
        f"| coin-trades (closed) | {s['n_trades']} | win rate | {s['win_rate']:.0%} |",
        f"| gross contribution | {s['gross_contribution']:+.1%} | costs | −{s['total_costs']:.1%} |",
        f"| net contribution | {s['net']:+.1%} | avg hold (days) | {s['avg_holding_days']} |",
        f"| best single trade | {s['best_trade']:+.1%} | worst single trade | {s['worst_trade']:+.1%} |",
        "",
        "## Which coins made (and lost) the money",
        "",
        "| coin | trades | contribution | $ (10k) |",
        "|------|--------|--------------|---------|",
    ]
    for coin, ntr, contrib in coin_rollup(trades):
        out.append(f"| {coin} | {ntr} | {contrib:+.1%} | {contrib * 10_000:+,.0f} |")
    out += ["",
            "_Contribution = the % each coin added to the portfolio's arithmetic return, "
            "net of overlays. Reconciles to portfolio equity. Long-only basket._"]
    return "\n".join(out)


if __name__ == "__main__":
    import argparse
    import os
    from . import data as data_mod
    from . import strategy as strat
    from . import multi_data as md
    from . import xsectional as xs
    from .forward_paper import FROZEN_STRATEGIES, HERE

    p = argparse.ArgumentParser(description="Per-trade blotter for a frozen strategy.")
    p.add_argument("--strategy", default="regime-trend")
    p.add_argument("--since", default=None, help="only trades entered on/after YYYY-MM-DD")
    args = p.parse_args()

    entry = FROZEN_STRATEGIES[args.strategy]
    if entry["kind"] == "single_asset":
        bars, _ = data_mod.get_ohlcv(csv_path=os.path.join(HERE, "sample-data", entry["data"]), limit=0)
        sig = strat.generate_signals(bars, entry["config"], periods_per_year=365)
        trades = extract_trades(bars, sig)
        if args.since:
            trades = filter_since(trades, args.since)
        md_text = format_md(trades, args.strategy, since=args.since)
    else:  # xsectional
        dates, series, _ = md.panel_from_csv(os.path.join(HERE, "sample-data", entry["data"]))
        universe = [a for a in entry["universe"] if a in series]
        cols = md.as_matrix(dates, series, universe)
        trades, total_costs = xs.portfolio_trades(dates, cols, entry["config"])
        if args.since:
            trades = [t for t in trades if t.entry_date >= args.since]
        md_text = format_xsec_md(trades, total_costs, args.strategy, since=args.since)
    print(md_text)
    path = os.path.join(HERE, f"quant-blotter-{args.strategy}.md")
    with open(path, "w") as fh:
        fh.write(md_text + "\n")
    print(f"\nBlotter → {path}")
