"""Forward paper-trade harness — the honest end of the road.

The research is over. Cross-sectional momentum + market risk-off is the one signal
with real, repeatable edge (PSR 1.0), honestly deflated by survivorship to ~51%
drawdown. No more searching. This module FREEZES that strategy and paper-trades it
FORWARD, accruing an unbiased track record on data that did not exist when the
strategy was designed. Forward paper equity — not any backtest — is the verdict.

Pre-registration integrity:
- The frozen config lives in forward-registration.json and is written ONCE.
- --register refuses to overwrite an existing registration (that would be moving
  the goalposts). Re-registering is a NEW hypothesis with a NEW start date.
- --run never optimizes anything. It only marks the frozen strategy to market.

In this repo the committed data ends 2026-05-23, so a registration dated today has
an empty forward window until new data arrives — that is correct and honest
("awaiting forward data"). --since lets you print an ILLUSTRATIVE replay from an
earlier date to see the tracker's output format; it is clearly labelled and is NOT
the live record.
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
from datetime import datetime

from . import multi_data as md
from . import xsectional as xs


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG_PATH = os.path.join(HERE, "forward-registration.json")
PANEL_PATH = os.path.join(HERE, "sample-data", "crypto_panel_expanded.csv")
STATE_MD = os.path.join(HERE, "quant-forward-state.md")
LOG_MD = os.path.join(HERE, "quant-forward-log.md")

# The frozen, pre-registered strategy. Chosen a priori from what the research
# established — NOT re-optimized on any holdout. This is the whole contract.
FROZEN = {
    "strategy": "xsectional-momentum-riskoff",
    "description": "long-only top-K cross-sectional momentum, market-trend risk-off "
                   "to cash, portfolio volatility targeting",
    "universe": ["btc", "eth", "ltc", "xrp", "bch", "doge", "xlm", "xmr", "etc",
                 "ada", "link", "trx", "dash", "zec", "eos", "xem", "dcr", "xvg",
                 "btg", "bsv", "neo", "xtz", "algo", "zrx", "bat", "rep", "knc",
                 "omg", "snx", "mkr", "comp", "ftt"],
    "config": {"lookback": 90, "top_k": 5, "rebalance": 30, "skip": 0,
               "market_filter": True, "market_trend_n": 100, "market_proxy": "btc",
               "vol_target": True, "target_vol": 0.40, "vol_lookback": 30,
               "max_leverage": 1.0},
    "mandate_max_drawdown": 0.40,
    "corrected_historical_drawdown": 0.51,  # what it did on the survivorship-corrected past
    "note": "Frozen. No re-optimization. Forward paper equity is the verdict. "
            "Historical corrected drawdown was ~51%, over the 40% mandate — forward "
            "trading is the unbiased tiebreaker.",
}


def _ts(date_str: str) -> int:
    return calendar.timegm(datetime.strptime(date_str[:10], "%Y-%m-%d").timetuple())


def _date(ts: int) -> str:
    return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")


def register(as_of: str, force: bool = False) -> dict:
    if os.path.exists(REG_PATH) and not force:
        with open(REG_PATH) as fh:
            existing = json.load(fh)
        print(f"Already registered on {existing['registered_as_of']} — refusing to "
              f"overwrite (pre-registration integrity). Use --force for a NEW hypothesis.")
        return existing
    reg = {**FROZEN, "registered_as_of": as_of}
    with open(REG_PATH, "w") as fh:
        json.dump(reg, fh, indent=2)
    print(f"Registered '{reg['strategy']}' as of {as_of}.")
    return reg


def _forward_metrics(since_ts: int) -> dict:
    """Compute the frozen strategy's paper performance on dates AFTER since_ts."""
    dates, series, _ = md.panel_from_csv(PANEL_PATH)
    universe = [a for a in FROZEN["universe"] if a in series]
    cols = md.as_matrix(dates, series, universe)
    rets = xs.portfolio_returns(dates, cols, FROZEN["config"])  # rets[i] realized on dates[i+1]
    fwd = [(dates[i + 1], rets[i]) for i in range(len(rets)) if dates[i + 1] > since_ts]
    if not fwd:
        last = _date(dates[-1]) if dates else "n/a"
        return {"n_days": 0, "last_data": last}
    fr = [r for _, r in fwd]
    m = xs.metrics(fr)
    eq = 1.0
    peak = 1.0
    cur_dd = 0.0
    for r in fr:
        eq *= (1.0 + r)
        peak = max(peak, eq)
        cur_dd = (peak - eq) / peak
    return {
        "n_days": len(fr),
        "first_forward": _date(fwd[0][0]),
        "last_forward": _date(fwd[-1][0]),
        "equity_mult": round(eq, 4),
        "total_return": m["total_return"],
        "sharpe": m["sharpe"],
        "max_drawdown": m["max_drawdown"],
        "current_drawdown": round(cur_dd, 4),
        "psr": m["psr"],
    }


def run(illustrative_since: str | None = None) -> dict:
    if not os.path.exists(REG_PATH):
        raise SystemExit("Not registered yet. Run: python -m engine.forward_paper --register")
    with open(REG_PATH) as fh:
        reg = json.load(fh)
    since = illustrative_since or reg["registered_as_of"]
    m = _forward_metrics(_ts(since))
    mandate = reg["mandate_max_drawdown"]
    within = m.get("n_days", 0) > 0 and m["max_drawdown"] <= mandate
    result = {
        "strategy": reg["strategy"],
        "registered_as_of": reg["registered_as_of"],
        "evaluating_since": since,
        "illustrative": illustrative_since is not None,
        "mandate_max_drawdown": mandate,
        "forward": m,
        "within_mandate": within,
    }
    _write_state(result, reg)
    return result


def _write_state(r: dict, reg: dict) -> None:
    m = r["forward"]
    lines = [
        "# Quant Forward Paper-Trade — State",
        "",
        f"Strategy: **{reg['strategy']}** (FROZEN)",
        f"Registered as-of: **{reg['registered_as_of']}**",
    ]
    if r["illustrative"]:
        lines.append(f"> ⚠️ ILLUSTRATIVE replay from {r['evaluating_since']} — NOT the live "
                     "forward record. Shows output format only.")
    lines.append("")
    if m.get("n_days", 0) == 0:
        lines += [
            f"**Awaiting forward data.** No bars after {r['evaluating_since']} "
            f"(latest data: {m.get('last_data','n/a')}).",
            "",
            "The strategy is registered and frozen. A real forward track record accrues",
            "as new daily data arrives (run `--run` on a schedule with a live feed).",
        ]
    else:
        lines += [
            f"Forward window: {m['first_forward']} → {m['last_forward']} ({m['n_days']} days)",
            "",
            "| metric | value |",
            "|--------|-------|",
            f"| paper equity | {m['equity_mult']}x |",
            f"| total return | {m['total_return']:.1%} |",
            f"| Sharpe | {m['sharpe']} |",
            f"| max drawdown | {m['max_drawdown']:.1%} |",
            f"| current drawdown | {m['current_drawdown']:.1%} |",
            f"| PSR | {m['psr']} |",
            "",
            f"Mandate: max drawdown ≤ {r['mandate_max_drawdown']:.0%} → "
            f"**{'WITHIN' if r['within_mandate'] else 'BREACHED'}** "
            f"(provisional until enough forward days).",
        ]
    lines += [
        "",
        "## Discipline",
        "",
        "- Paper only. No live orders. No re-optimization — the config is frozen.",
        f"- Corrected historical drawdown was ~{reg['corrected_historical_drawdown']:.0%} "
        "(over mandate); forward is the unbiased tiebreaker.",
        "- To change the strategy, register a NEW hypothesis with a NEW start date.",
        "",
        "---",
        "_engine/forward_paper.py — forward paper equity is the verdict, not a backtest._",
    ]
    with open(STATE_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    if m.get("n_days", 0) > 0:
        header = not os.path.exists(LOG_MD)
        with open(LOG_MD, "a") as fh:
            if header:
                fh.write("# Forward Paper Log\n\n| eval_since | days | equity | Sharpe | maxDD | "
                         "curDD | within_mandate |\n|---|---|---|---|---|---|---|\n")
            fh.write(f"| {r['evaluating_since']} | {m['n_days']} | {m['equity_mult']}x | "
                     f"{m['sharpe']} | {m['max_drawdown']:.0%} | {m['current_drawdown']:.0%} | "
                     f"{'yes' if r['within_mandate'] else 'NO'} |\n")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Forward paper-trade the frozen strategy.")
    p.add_argument("--register", action="store_true", help="freeze the strategy (write-once)")
    p.add_argument("--as-of", default=None, dest="as_of",
                   help="registration date YYYY-MM-DD (default: latest data date)")
    p.add_argument("--force", action="store_true", help="overwrite registration (new hypothesis)")
    p.add_argument("--run", action="store_true", help="mark the frozen strategy to market")
    p.add_argument("--since", default=None,
                   help="ILLUSTRATIVE replay from this date (not the live record)")
    args = p.parse_args(argv)

    if args.register:
        as_of = args.as_of
        if as_of is None:
            dates, _, _ = md.panel_from_csv(PANEL_PATH)
            as_of = _date(dates[-1])
        register(as_of, force=args.force)
    if args.run or args.since or not args.register:
        result = run(illustrative_since=args.since)
        print(json.dumps(result, indent=2))
        print(f"\nState → {STATE_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
