"""Forward paper-trade harness — the honest end of the road.

The research is over. Two strategies earned a forward test:
  - xsectional-momentum-riskoff : the multi-asset signal with real edge (PSR 1.0),
    honestly deflated by survivorship to ~51% drawdown.
  - regime-trend                : the humble single-asset trend that, once
    survivorship is accounted for, is the better RISK bet (~37% forward drawdown).

Both are FROZEN and paper-traded FORWARD on data that did not exist when they were
designed. Forward paper equity — not any backtest — is the verdict.

Pre-registration integrity:
- Each strategy is registered write-once into forward-registration.json.
- --register refuses to overwrite an existing entry (that would move goalposts).
  Changing a strategy means a NEW name with a NEW start date.
- --run never optimizes. It only marks the frozen strategies to market.

Committed data ends 2026-05-23, so a today-dated registration has an empty forward
window ("awaiting forward data") until a live feed adds bars. --since prints an
ILLUSTRATIVE replay from an earlier date; it is clearly labelled, not the record.
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
from datetime import datetime

from . import multi_data as md
from . import xsectional as xs
from . import data as data_mod
from . import backtest as bt
from . import strategy as strat


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG_PATH = os.path.join(HERE, "forward-registration.json")
STATE_MD = os.path.join(HERE, "quant-forward-state.md")
LOG_MD = os.path.join(HERE, "quant-forward-log.md")
PPY = 365

# The frozen, pre-registered strategies. Configs are a priori — NOT re-optimized
# on any holdout. This registry is the contract.
FROZEN_STRATEGIES = {
    "xsectional-momentum-riskoff": {
        "kind": "xsectional",
        "description": "long-only top-K cross-sectional momentum, market-trend risk-off, vol targeting",
        "data": "crypto_panel_expanded.csv",
        "universe": ["btc", "eth", "ltc", "xrp", "bch", "doge", "xlm", "xmr", "etc",
                     "ada", "link", "trx", "dash", "zec", "eos", "xem", "dcr", "xvg",
                     "btg", "bsv", "neo", "xtz", "algo", "zrx", "bat", "rep", "knc",
                     "omg", "snx", "mkr", "comp", "ftt"],
        "config": {"lookback": 90, "top_k": 5, "rebalance": 30, "skip": 0,
                   "market_filter": True, "market_trend_n": 100, "market_proxy": "btc",
                   "vol_target": True, "target_vol": 0.40, "vol_lookback": 30, "max_leverage": 1.0},
        "mandate_max_drawdown": 0.40,
        "corrected_historical_drawdown": 0.51,
    },
    "regime-trend": {
        "kind": "single_asset",
        "description": "BTC long/flat trend gated by a calm-volatility regime, vol targeting",
        "data": "btc_1d_coinmetrics.csv",
        "config": {"strategy": "regime", "trend_lookback": 100, "vol_regime_lookback": 30,
                   "vol_target": True, "target_vol": 0.40, "vol_lookback": 30, "max_leverage": 1.0},
        "mandate_max_drawdown": 0.40,
        "corrected_historical_drawdown": 0.37,
    },
}


def _ts(date_str: str) -> int:
    return calendar.timegm(datetime.strptime(date_str[:10], "%Y-%m-%d").timetuple())


def _date(ts: int) -> str:
    return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")


def _load_reg() -> dict:
    if not os.path.exists(REG_PATH):
        return {}
    with open(REG_PATH) as fh:
        data = json.load(fh)
    # migrate the old single flat format -> keyed dict
    if "strategy" in data and "registered_as_of" in data:
        return {data["strategy"]: data}
    return data


def register(name: str, as_of: str, force: bool = False) -> None:
    if name not in FROZEN_STRATEGIES:
        raise SystemExit(f"Unknown strategy '{name}'. Known: {list(FROZEN_STRATEGIES)}")
    reg = _load_reg()
    if name in reg and not force:
        print(f"'{name}' already registered as of {reg[name]['registered_as_of']} — "
              f"refusing to overwrite (pre-registration integrity). Use --force for a new hypothesis.")
        return
    reg[name] = {**FROZEN_STRATEGIES[name], "strategy": name, "registered_as_of": as_of}
    with open(REG_PATH, "w") as fh:
        json.dump(reg, fh, indent=2)
    print(f"Registered '{name}' as of {as_of}.")


def _forward_pairs(entry: dict) -> list[tuple[int, float]]:
    """Return [(realized_ts, daily_return)] for the frozen strategy over ALL data."""
    cfg = entry["config"]
    if entry["kind"] == "xsectional":
        path = os.path.join(HERE, "sample-data", entry["data"])
        dates, series, _ = md.panel_from_csv(path)
        universe = [a for a in entry["universe"] if a in series]
        cols = md.as_matrix(dates, series, universe)
        rets = xs.portfolio_returns(dates, cols, cfg)  # rets[i] realized on dates[i+1]
        return [(dates[i + 1], rets[i]) for i in range(len(rets))]
    # single-asset
    path = os.path.join(HERE, "sample-data", entry["data"])
    bars, _ = data_mod.get_ohlcv(csv_path=path, limit=0)
    sig = strat.generate_signals(bars, cfg, periods_per_year=PPY)
    res = bt.run_backtest(bars, sig, periods_per_year=PPY)  # res.returns[i] realized on bars[i+1]
    return [(bars[i + 1].ts, res.returns[i]) for i in range(len(res.returns))]


def _metrics(entry: dict, since_ts: int) -> dict:
    fwd = [(ts, r) for ts, r in _forward_pairs(entry) if ts > since_ts]
    if not fwd:
        pairs = _forward_pairs(entry)
        last = _date(pairs[-1][0]) if pairs else "n/a"
        return {"n_days": 0, "last_data": last}
    fr = [r for _, r in fwd]
    m = xs.metrics(fr, PPY)
    eq, peak, cur_dd = 1.0, 1.0, 0.0
    for r in fr:
        eq *= (1.0 + r)
        peak = max(peak, eq)
        cur_dd = (peak - eq) / peak
    return {"n_days": len(fr), "first_forward": _date(fwd[0][0]), "last_forward": _date(fwd[-1][0]),
            "equity_mult": round(eq, 4), "total_return": m["total_return"], "sharpe": m["sharpe"],
            "max_drawdown": m["max_drawdown"], "current_drawdown": round(cur_dd, 4), "psr": m["psr"]}


def run(only: str | None = None, illustrative_since: str | None = None) -> dict:
    reg = _load_reg()
    if not reg:
        raise SystemExit("Nothing registered. Run: python -m engine.forward_paper --register --strategy <name>")
    names = [only] if only else list(reg)
    results = {}
    for name in names:
        if name not in reg:
            raise SystemExit(f"'{name}' is not registered.")
        entry = reg[name]
        since = illustrative_since or entry["registered_as_of"]
        m = _metrics(entry, _ts(since))
        mandate = entry["mandate_max_drawdown"]
        results[name] = {
            "registered_as_of": entry["registered_as_of"], "evaluating_since": since,
            "illustrative": illustrative_since is not None, "mandate_max_drawdown": mandate,
            "kind": entry["kind"], "forward": m,
            "within_mandate": m.get("n_days", 0) > 0 and m["max_drawdown"] <= mandate,
        }
    _write_state(results, reg)
    return results


def _write_state(results: dict, reg: dict) -> None:
    lines = ["# Quant Forward Paper-Trade — State", "",
             f"{len(reg)} strategy(ies) registered and FROZEN. Forward paper equity is the verdict.", ""]
    for name, r in results.items():
        m = r["forward"]
        lines.append(f"## {name}")
        lines.append("")
        lines.append(f"- kind: `{r['kind']}` · registered as-of **{r['registered_as_of']}** · "
                     f"mandate maxDD ≤ {r['mandate_max_drawdown']:.0%}")
        if r["illustrative"]:
            lines.append(f"- ⚠️ ILLUSTRATIVE replay from {r['evaluating_since']} — not the live record.")
        if m.get("n_days", 0) == 0:
            lines.append(f"- **Awaiting forward data** (latest data {m.get('last_data','n/a')}). "
                         "Track accrues as new bars arrive.")
        else:
            verdict = "WITHIN" if r["within_mandate"] else "BREACHED"
            lines += [
                f"- forward {m['first_forward']} → {m['last_forward']} ({m['n_days']} days)",
                f"- equity **{m['equity_mult']}x** · return {m['total_return']:.1%} · "
                f"Sharpe **{m['sharpe']}** · maxDD **{m['max_drawdown']:.1%}** · "
                f"curDD {m['current_drawdown']:.1%} · PSR {m['psr']}",
                f"- mandate: **{verdict}** (provisional until enough forward days)",
            ]
        lines.append("")
    lines += ["## Discipline", "",
              "- Paper only. No live orders. No re-optimization — configs are frozen.",
              "- To change a strategy, register a NEW name with a NEW start date.",
              "", "---", "_engine/forward_paper.py — forward equity is the verdict, not a backtest._"]
    with open(STATE_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    logged = [(n, r) for n, r in results.items() if r["forward"].get("n_days", 0) > 0]
    if logged:
        header = not os.path.exists(LOG_MD)
        with open(LOG_MD, "a") as fh:
            if header:
                fh.write("# Forward Paper Log\n\n| strategy | eval_since | days | equity | Sharpe | "
                         "maxDD | within |\n|---|---|---|---|---|---|---|\n")
            for n, r in logged:
                m = r["forward"]
                fh.write(f"| {n} | {r['evaluating_since']} | {m['n_days']} | {m['equity_mult']}x | "
                         f"{m['sharpe']} | {m['max_drawdown']:.0%} | "
                         f"{'yes' if r['within_mandate'] else 'NO'} |\n")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Forward paper-trade the frozen strategies.")
    p.add_argument("--register", action="store_true", help="freeze a strategy (write-once)")
    p.add_argument("--strategy", default=None, help="strategy name (for --register/--run/--since)")
    p.add_argument("--as-of", default=None, dest="as_of", help="registration date YYYY-MM-DD")
    p.add_argument("--force", action="store_true", help="overwrite registration (new hypothesis)")
    p.add_argument("--run", action="store_true", help="mark frozen strategies to market")
    p.add_argument("--since", default=None, help="ILLUSTRATIVE replay from this date")
    args = p.parse_args(argv)

    if args.register:
        if not args.strategy:
            raise SystemExit(f"--register needs --strategy. Known: {list(FROZEN_STRATEGIES)}")
        as_of = args.as_of
        if as_of is None:  # default: latest date in that strategy's data
            pairs = _forward_pairs(FROZEN_STRATEGIES[args.strategy])
            as_of = _date(pairs[-1][0])
        register(args.strategy, as_of, force=args.force)
    if args.run or args.since or not args.register:
        results = run(only=args.strategy, illustrative_since=args.since)
        print(json.dumps(results, indent=2))
        print(f"\nState → {STATE_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
