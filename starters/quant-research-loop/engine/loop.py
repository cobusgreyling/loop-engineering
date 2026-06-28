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
from .verifier import verify, verify_on_lockbox
from .paper_broker import PaperBroker
from .ledger import ResearchLedger
from .split import three_way
from .search import grid_search, TrialCounter, DEFAULT_GRID
from .walkforward import walk_forward


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_MD = os.path.join(HERE, "quant-state.md")
RUN_LOG = os.path.join(HERE, "quant-run-log.md")
BROKER_STATE = os.path.join(HERE, "paper-account.json")
LEDGER_PATH = os.path.join(HERE, "research-ledger.json")

# Bars-per-year by timeframe. Annualization MUST match the bar size or every
# Sharpe is silently scaled wrong (hourly annualization on daily bars inflates
# Sharpe ~5x — exactly the kind of self-deception this engine exists to prevent).
PERIODS_PER_YEAR = {"1h": 24 * 365, "4h": 6 * 365, "1d": 365}


def run_once(args) -> dict:
    params = dict(DEFAULT_PARAMS)
    ppy = PERIODS_PER_YEAR[args.timeframe]

    # 1. Ingest
    bars, provenance = data_mod.get_ohlcv(
        source=args.source, csv_path=args.csv, symbol=args.symbol,
        interval=args.timeframe, limit=args.limit, seed=args.seed)

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


def run_campaign(args) -> dict:
    """Search mode (#1 enforced trial counting + #2 lockbox).

    train  -> search optimizes here
    valid  -> candidates ranked here (used up by design)
    lockbox-> opened ONCE on the winner; deflated by CUMULATIVE trials
    """
    ppy = PERIODS_PER_YEAR[args.timeframe]
    ledger = ResearchLedger(LEDGER_PATH)

    # 1. Ingest + three-way split
    bars, provenance = data_mod.get_ohlcv(
        source=args.source, csv_path=args.csv, symbol=args.symbol,
        interval=args.timeframe, limit=args.limit, seed=args.seed)
    split = three_way(bars, train_frac=args.train_frac, validation_frac=args.validation_frac)

    # 2. Search with ENFORCED counting; persist cumulative trials to the ledger.
    counter = TrialCounter()
    candidates = grid_search(split.train, split.validation, counter,
                             grid=DEFAULT_GRID, fee_bps=args.fee_bps,
                             slippage_bps=args.slippage_bps, periods_per_year=ppy)
    ledger.add_trials(counter.n)
    winner = candidates[0]

    # 3. Open the lockbox ONCE on the winner. Deflated by everything ever searched.
    verdict = verify_on_lockbox(
        split.lockbox, winner.params, n_trials=ledger.cumulative_trials,
        ledger=ledger, max_openings=args.lockbox_openings,
        min_lockbox_sharpe=args.min_oos_sharpe,
        max_lockbox_drawdown=args.max_oos_drawdown,
        fee_bps=args.fee_bps, slippage_bps=args.slippage_bps, periods_per_year=ppy)

    # 4. Paper execution — only if the lockbox passed (never if blocked).
    broker = PaperBroker(BROKER_STATE, starting_cash=args.capital,
                         fee_bps=args.fee_bps, slippage_bps=args.slippage_bps)
    price, ts = bars[-1].close, bars[-1].ts
    target_now = generate_signals(bars, winner.params)[-1]
    if verdict.passed:
        fill = broker.rebalance(float(target_now) * args.max_fraction, price, ts)
        exec_note = f"lockbox PASS → paper {fill['action']}"
    elif verdict.blocked:
        broker.mark(price)
        exec_note = "lockbox BLOCKED (already spent) → no execution"
    else:
        broker.mark(price)
        exec_note = "lockbox REJECT → no execution (correct default)"

    # 5. Risk kill-switch on realized paper equity.
    equity_curve = [h["equity"] for h in broker.acct.history] or [broker.acct.equity]
    rv = risk_mod.check(equity_curve, max_drawdown=args.kill_drawdown)
    if rv.breached:
        broker.flatten(price, ts, reason=rv.reason)
        exec_note += f" | KILL SWITCH: {rv.reason}"
    broker.save()
    ledger.save()

    result = {
        "mode": "campaign",
        "provenance": provenance,
        "split": split.summary(),
        "candidates_searched_this_cycle": counter.n,
        "cumulative_trials": ledger.cumulative_trials,
        "winner_params": winner.params,
        "winner_validation_sharpe": round(winner.validation_sharpe, 3),
        "winner_train_sharpe": round(winner.train_sharpe, 3),
        "target_now": target_now,
        "verdict_passed": verdict.passed,
        "verdict_blocked": verdict.blocked,
        "verdict_reasons": verdict.reasons(),
        "lockbox": verdict.lockbox_summary,
        "lockbox_fingerprint": verdict.fingerprint,
        "paper_equity": round(broker.acct.equity, 2),
        "risk": {"breached": rv.breached, "reason": rv.reason, "drawdown": round(rv.drawdown, 4)},
        "exec_note": exec_note,
    }
    write_campaign_state(result)
    return result


def write_campaign_state(r: dict) -> None:
    synthetic = r["provenance"].upper().startswith("SYNTHETIC")
    if r["verdict_blocked"]:
        verdict_str = "BLOCKED (lockbox already spent)"
    else:
        verdict_str = "PASS" if r["verdict_passed"] else "REJECT"
    lines = [
        "# Quant Research Loop — State (campaign / search mode)",
        "",
        f"Last run provenance: `{r['provenance']}`"
        + ("  ⚠️ SYNTHETIC DATA — not real market behavior" if synthetic else ""),
        f"Lockbox fingerprint: `{r['lockbox_fingerprint']}`",
        "",
        "## Search accounting (the anti-self-deception spine)",
        "",
        f"- Candidates searched **this cycle**: {r['candidates_searched_this_cycle']}",
        f"- **Cumulative trials (all cycles, enforced): {r['cumulative_trials']}**",
        f"- Winner params: `{r['winner_params']}`",
        f"- Winner validation Sharpe: {r['winner_validation_sharpe']} "
        f"(train {r['winner_train_sharpe']})",
        "",
        "## Decision this cycle",
        "",
        f"- Maker target position: **{r['target_now']}** (1=long, 0=flat)",
        f"- Lockbox verdict: **{verdict_str}**",
        f"- Execution: {r['exec_note']}",
        f"- Paper equity: **{r['paper_equity']}**",
        f"- Risk: drawdown {r['risk']['drawdown']:.2%} — "
        + ("**BREACHED**" if r["risk"]["breached"] else "within cap"),
        "",
        "## Lockbox gates (opened once, deflated by cumulative trials)",
        "",
    ]
    for reason in r["verdict_reasons"]:
        lines.append(f"- {reason}")
    m = r.get("lockbox") or {}
    lines += [
        "",
        "## Lockbox metrics",
        "",
        "| sharpe | maxDD | trades | total_return |",
        "|--------|-------|--------|--------------|",
        f"| {m.get('sharpe','—')} | {m.get('max_drawdown','—')} | "
        f"{m.get('n_trades','—')} | {m.get('total_return','—')} |",
        "",
        "## Human gates (unchanged)",
        "",
        "- Paper trading only. Live execution is NOT wired (see LOOP.md).",
        "- Lockbox is write-once per dataset. A BLOCKED verdict means: get fresh",
        "  data or forward-test. Do not reset the ledger to re-peek.",
        "",
        "---",
        "_Written by engine/loop.py (campaign mode). The lockbox decides; the "
        "deflated benchmark rises with every trial ever run._",
    ]
    with open(STATE_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    header_needed = not os.path.exists(RUN_LOG)
    with open(RUN_LOG, "a") as fh:
        if header_needed:
            fh.write("# Quant Run Log\n\n| provenance | mode | verdict | cum_trials | "
                     "target | paper_equity | dd |\n|---|---|---|---|---|---|---|\n")
        fh.write(f"| {r['provenance']} | campaign | {verdict_str} | "
                 f"{r['cumulative_trials']} | {r['target_now']} | "
                 f"{r['paper_equity']} | {r['risk']['drawdown']:.2%} |\n")


def run_walkforward(args) -> dict:
    """Walk-forward mode (#3). Re-optimizes on a rolling in-sample window and
    scores each out-of-sample fold; requires K-of-N folds to pass AND the pooled
    OOS curve to clear the deflated/PSR/drawdown gates."""
    ppy = PERIODS_PER_YEAR[args.timeframe]
    ledger = ResearchLedger(LEDGER_PATH)

    bars, provenance = data_mod.get_ohlcv(
        source=args.source, csv_path=args.csv, symbol=args.symbol,
        interval=args.timeframe, limit=args.limit, seed=args.seed)

    wf = walk_forward(
        bars, n_folds=args.folds, k_required=args.k_required,
        rolling_window_folds=(args.rolling_window_folds or None),
        n_trials_so_far=ledger.cumulative_trials,
        min_aggregate_sharpe=args.min_oos_sharpe,
        max_aggregate_drawdown=args.max_oos_drawdown,
        fee_bps=args.fee_bps, slippage_bps=args.slippage_bps, periods_per_year=ppy)
    ledger.add_trials(wf.trials_this_run)
    ledger.save()

    # Paper-execute the most-recent fold's winner only if the whole WF passed.
    broker = PaperBroker(BROKER_STATE, starting_cash=args.capital,
                         fee_bps=args.fee_bps, slippage_bps=args.slippage_bps)
    price, ts = bars[-1].close, bars[-1].ts
    recent_params = wf.folds[-1].winner_params if wf.folds else DEFAULT_PARAMS
    target_now = generate_signals(bars, recent_params)[-1]
    if wf.passed:
        fill = broker.rebalance(float(target_now) * args.max_fraction, price, ts)
        exec_note = f"walk-forward PASS → paper {fill['action']}"
    else:
        broker.mark(price)
        exec_note = "walk-forward REJECT → no execution (correct default)"
    equity_curve = [h["equity"] for h in broker.acct.history] or [broker.acct.equity]
    rv = risk_mod.check(equity_curve, max_drawdown=args.kill_drawdown)
    if rv.breached:
        broker.flatten(price, ts, reason=rv.reason)
        exec_note += f" | KILL SWITCH: {rv.reason}"
    broker.save()

    result = {
        "mode": "walkforward",
        "provenance": provenance,
        "anchored": not (args.rolling_window_folds or 0),
        "walkforward": wf.summary(),
        "folds": [{
            "fold": f.index, "is_bars": f.is_bars, "oos_bars": f.oos_bars,
            "params": f.winner_params, "is_sharpe": f.is_sharpe,
            "oos_sharpe": f.oos_sharpe, "oos_maxDD": f.oos_max_drawdown,
            "oos_trades": f.oos_trades, "passed": f.passed,
        } for f in wf.folds],
        "verdict_reasons": wf.reasons(),
        "cumulative_trials": ledger.cumulative_trials,
        "target_now": target_now,
        "verdict_passed": wf.passed,
        "paper_equity": round(broker.acct.equity, 2),
        "risk": {"breached": rv.breached, "reason": rv.reason, "drawdown": round(rv.drawdown, 4)},
        "exec_note": exec_note,
    }
    write_walkforward_state(result)
    return result


def write_walkforward_state(r: dict) -> None:
    synthetic = r["provenance"].upper().startswith("SYNTHETIC")
    wf = r["walkforward"]
    lines = [
        "# Quant Research Loop — State (walk-forward mode)",
        "",
        f"Last run provenance: `{r['provenance']}`"
        + ("  ⚠️ SYNTHETIC DATA — not real market behavior" if synthetic else ""),
        f"Scheme: {'anchored' if r['anchored'] else 'rolling'} walk-forward",
        "",
        "## Verdict",
        "",
        f"- **{'PASS' if r['verdict_passed'] else 'REJECT'}** "
        f"({wf['passes']}/{wf['n_folds']} folds, need {wf['k_required']})",
        f"- Cumulative trials (enforced): **{r['cumulative_trials']}**",
        f"- Execution: {r['exec_note']}",
        f"- Paper equity: **{r['paper_equity']}**",
        "",
        "## Gates",
        "",
    ]
    for reason in r["verdict_reasons"]:
        lines.append(f"- {reason}")
    lines += [
        "",
        "## Per-fold out-of-sample results",
        "",
        "| fold | IS bars | OOS bars | params | IS Sharpe | OOS Sharpe | OOS maxDD | pass |",
        "|------|---------|----------|--------|-----------|------------|-----------|------|",
    ]
    for f in r["folds"]:
        lines.append(
            f"| {f['fold']} | {f['is_bars']} | {f['oos_bars']} | "
            f"`{f['params']}` | {f['is_sharpe']} | {f['oos_sharpe']} | "
            f"{f['oos_maxDD']:.2%} | {'✓' if f['passed'] else '✗'} |")
    lines += [
        "",
        f"Pooled OOS: Sharpe {wf['aggregate_sharpe']} · PSR {wf['aggregate_psr']} · "
        f"maxDD {wf['aggregate_max_drawdown']:.2%} · deflated bar {wf['deflated_benchmark']}",
        "",
        "## Human gates (unchanged)",
        "",
        "- Paper trading only. Live execution is NOT wired (see LOOP.md).",
        "- A PASS here means the *selection process* generalized across regimes —",
        "  it is the green light to forward-test, not to deploy capital.",
        "",
        "---",
        "_Written by engine/loop.py (walk-forward mode)._",
    ]
    with open(STATE_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    header_needed = not os.path.exists(RUN_LOG)
    with open(RUN_LOG, "a") as fh:
        if header_needed:
            fh.write("# Quant Run Log\n\n| provenance | mode | verdict | cum_trials | "
                     "target | paper_equity | dd |\n|---|---|---|---|---|---|---|\n")
        fh.write(f"| {r['provenance']} | walkforward | "
                 f"{'PASS' if r['verdict_passed'] else 'REJECT'} | "
                 f"{r['cumulative_trials']} | {r['target_now']} | "
                 f"{r['paper_equity']} | {r['risk']['drawdown']:.2%} |\n")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Quant research loop — one cycle (paper only).")
    p.add_argument("--once", action="store_true", help="run a single cycle")
    p.add_argument("--search", action="store_true",
                   help="campaign mode: grid-search with enforced trial counting + lockbox")
    p.add_argument("--walkforward", action="store_true",
                   help="walk-forward mode: K-of-N rolling out-of-sample validation")
    p.add_argument("--folds", type=int, default=5, help="walk-forward fold count")
    p.add_argument("--k-required", type=int, default=None, dest="k_required",
                   help="folds that must pass (default ceil(0.6*folds))")
    p.add_argument("--rolling-window-folds", type=int, default=0, dest="rolling_window_folds",
                   help="0 = anchored (in-sample grows); >0 = fixed sliding window of N folds")
    p.add_argument("--train-frac", type=float, default=0.5, dest="train_frac")
    p.add_argument("--validation-frac", type=float, default=0.25, dest="validation_frac")
    p.add_argument("--lockbox-openings", type=int, default=1, dest="lockbox_openings",
                   help="max times a given lockbox may be opened (write-once = 1)")
    p.add_argument("--source", default="synthetic",
                   choices=["synthetic", "live", "coinmetrics"],
                   help="live=Binance OHLCV (US users: see README); "
                        "coinmetrics=real daily close history (works behind egress policy)")
    p.add_argument("--csv", default=None, help="path to OHLCV csv (overrides --source)")
    p.add_argument("--symbol", default="BTCUSDT", help="e.g. BTCUSDT (spot)")
    p.add_argument("--timeframe", default="1d", choices=list(PERIODS_PER_YEAR),
                   help="bar size; also sets Sharpe annualization. Default 1d.")
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
    if args.walkforward:
        result = run_walkforward(args)
    elif args.search:
        result = run_campaign(args)
    else:
        result = run_once(args)
    print(json.dumps(result, indent=2))
    print(f"\nState written to {STATE_MD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
