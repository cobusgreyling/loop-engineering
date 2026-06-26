"""Orchestrator — one full cycle of the five-stage quant research loop.

Run one cycle:
    python -m engine.loop --once

The cycle is deliberately PAPER-only and report-first (L1/L2). It:
  1. ingests data (synthetic by default; --source live or --csv for real)
  2. generates signals (maker)
  3. runs a full-sample backtest for context
  4. verifies on out-of-sample data with overfitting penalties (checker)
  5. paper-executes the current target position ONLY if the checker passed
  6. runs the risk kill-switch on paper equity
  7. writes quant-state.md and appends quant-run-log.md

Nothing here can place a real order. See LOOP.md for the live-trading gate.
"""
from __future__ import annotations

import argparse
import json
import os

from . import data as data_mod
from . import risk as risk_mod
from .strategy import generate_signals, DEFAULT_PARAMS
from .backtest import run_backtest
from .verifier import verify
from .paper_broker import PaperBroker


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_MD = os.path.join(HERE, "quant-state.md")
RUN_LOG = os.path.join(HERE, "quant-run-log.md")
BROKER_STATE = os.path.join(HERE, "paper-account.json")


def run_once(args) -> dict:
    params = dict(DEFAULT_PARAMS)
    ppy = 24 * 365  # hourly bars

    # 1. Ingest
    bars, provenance = data_mod.get_ohlcv(
        source=args.source, csv_path=args.csv, symbol=args.symbol,
        interval=args.interval, limit=args.limit, seed=args.seed)

    # 2. Maker
    signals = generate_signals(bars, params)
    target_now = signals[-1]  # position to hold into the next bar

    # 3. Full-sample backtest (context only — never the gate)
    full = run_backtest(bars, signals, fee_bps=args.fee_bps,
                        slippage_bps=args.slippage_bps, periods_per_year=ppy)

    # 4. Checker — the real gate
    verdict = verify(bars, params, n_trials=args.n_trials,
                     min_oos_sharpe=args.min_oos_sharpe,
                     max_oos_drawdown=args.max_oos_drawdown,
                     fee_bps=args.fee_bps, slippage_bps=args.slippage_bps,
                     periods_per_year=ppy)

    # 5. Execution — paper only, and only if the checker passed
    broker = PaperBroker(BROKER_STATE, starting_cash=args.capital,
                         fee_bps=args.fee_bps, slippage_bps=args.slippage_bps)
    price = bars[-1].close
    ts = bars[-1].ts
    if verdict.passed:
        fill = broker.rebalance(float(target_now) * args.max_fraction, price, ts)
        exec_note = f"verified → paper {fill['action']} (target {fill.get('target_fraction')})"
    else:
        broker.mark(price)
        exec_note = "checker REJECTED → no execution (correct default)"

    # 6. Risk kill-switch on realized (paper) equity
    equity_curve = [h["equity"] for h in broker.acct.history] or [broker.acct.equity]
    rv = risk_mod.check(equity_curve, max_drawdown=args.kill_drawdown)
    if rv.breached:
        broker.flatten(price, ts, reason=rv.reason)
        exec_note += f" | KILL SWITCH: {rv.reason}"
    broker.save()

    result = {
        "provenance": provenance,
        "params": params,
        "target_now": target_now,
        "full_sample": full.summary(),
        "verdict_passed": verdict.passed,
        "verdict_reasons": verdict.reasons(),
        "oos": verdict.oos_summary,
        "is": verdict.is_summary,
        "paper_equity": round(broker.acct.equity, 2),
        "risk": {"breached": rv.breached, "reason": rv.reason, "drawdown": round(rv.drawdown, 4)},
        "exec_note": exec_note,
    }
    write_state(result)
    return result


def write_state(r: dict) -> None:
    synthetic = r["provenance"].upper().startswith("SYNTHETIC")
    lines = [
        "# Quant Research Loop — State",
        "",
        f"Last run provenance: `{r['provenance']}`"
        + ("  ⚠️ SYNTHETIC DATA — not real market behavior" if synthetic else ""),
        "",
        "## Decision this cycle",
        "",
        f"- Maker target position: **{r['target_now']}** (1=long, 0=flat)",
        f"- Checker verdict: **{'PASS' if r['verdict_passed'] else 'REJECT'}**",
        f"- Execution: {r['exec_note']}",
        f"- Paper equity: **{r['paper_equity']}**",
        f"- Risk: drawdown {r['risk']['drawdown']:.2%} — "
        + ("**BREACHED**" if r["risk"]["breached"] else "within cap"),
        "",
        "## Checker gates (out-of-sample)",
        "",
    ]
    for reason in r["verdict_reasons"]:
        lines.append(f"- {reason}")
    lines += [
        "",
        "## Metrics",
        "",
        "| window | sharpe | maxDD | trades | total_return |",
        "|--------|--------|-------|--------|--------------|",
    ]
    for label, key in (("in-sample", "is"), ("out-of-sample", "oos"), ("full", "full_sample")):
        m = r.get(key) or {}
        lines.append(
            f"| {label} | {m.get('sharpe','—')} | {m.get('max_drawdown','—')} | "
            f"{m.get('n_trades','—')} | {m.get('total_return','—')} |"
        )
    lines += [
        "",
        "## Human gates (unchanged)",
        "",
        "- Paper trading only. Live execution is NOT wired (see LOOP.md).",
        "- Every appended 'lesson' must be re-tested out-of-sample, not patched in.",
        "",
        "---",
        "_Written by engine/loop.py. Backtest metrics are context; the checker gate decides._",
    ]
    with open(STATE_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    header_needed = not os.path.exists(RUN_LOG)
    with open(RUN_LOG, "a") as fh:
        if header_needed:
            fh.write("# Quant Run Log\n\n| provenance | verdict | target | paper_equity | dd |\n"
                     "|---|---|---|---|---|\n")
        fh.write(f"| {r['provenance']} | {'PASS' if r['verdict_passed'] else 'REJECT'} | "
                 f"{r['target_now']} | {r['paper_equity']} | {r['risk']['drawdown']:.2%} |\n")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Quant research loop — one cycle (paper only).")
    p.add_argument("--once", action="store_true", help="run a single cycle")
    p.add_argument("--source", default="synthetic", choices=["synthetic", "live"])
    p.add_argument("--csv", default=None, help="path to OHLCV csv (overrides --source)")
    p.add_argument("--symbol", default="BTCUSDT")
    p.add_argument("--interval", default="1h")
    p.add_argument("--limit", type=int, default=1500)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--capital", type=float, default=10_000.0)
    p.add_argument("--max-fraction", type=float, default=0.95, dest="max_fraction")
    p.add_argument("--fee-bps", type=float, default=5.0, dest="fee_bps")
    p.add_argument("--slippage-bps", type=float, default=5.0, dest="slippage_bps")
    p.add_argument("--n-trials", type=int, default=1, dest="n_trials",
                   help="how many param sets you searched (be honest — inflates the bar)")
    p.add_argument("--min-oos-sharpe", type=float, default=1.0, dest="min_oos_sharpe")
    p.add_argument("--max-oos-drawdown", type=float, default=0.25, dest="max_oos_drawdown")
    p.add_argument("--kill-drawdown", type=float, default=0.10, dest="kill_drawdown")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    result = run_once(args)
    print(json.dumps(result, indent=2))
    print(f"\nState written to {STATE_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
