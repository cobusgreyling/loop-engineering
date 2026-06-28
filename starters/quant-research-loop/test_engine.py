"""Smoke + correctness tests. Run: python3 -m pytest, or python3 test_engine.py

Stdlib only — no pytest required.
"""
from __future__ import annotations

import math

import os
import tempfile

from engine import data, stats, strategy, backtest, verifier, risk
from engine.paper_broker import PaperBroker
from engine.split import three_way
from engine.ledger import ResearchLedger, fingerprint
from engine.search import grid_search, TrialCounter, expand_grid, DEFAULT_GRID


def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol


def test_synthetic_is_deterministic():
    a, _ = data.get_ohlcv(seed=7, limit=200)
    b, _ = data.get_ohlcv(seed=7, limit=200)
    assert [x.close for x in a] == [x.close for x in b], "synthetic data must be reproducible"
    c, _ = data.get_ohlcv(seed=8, limit=200)
    assert [x.close for x in a] != [x.close for x in c], "different seed -> different series"


def test_norm_ppf_inverts_cdf():
    for p in (0.01, 0.1, 0.5, 0.9, 0.99):
        assert approx(stats.norm_cdf(stats.norm_ppf(p)), p, 1e-4)


def test_max_drawdown():
    assert approx(stats.max_drawdown([1.0, 1.2, 0.6, 0.9]), 0.5)  # 1.2 -> 0.6
    assert approx(stats.max_drawdown([1, 2, 3]), 0.0)


def test_no_lookahead_signal_length():
    bars, _ = data.get_ohlcv(seed=3, limit=300)
    sig = strategy.generate_signals(bars)
    assert len(sig) == len(bars)
    assert all(s in (0, 1) for s in sig)
    assert all(s == 0 for s in sig[:strategy.DEFAULT_PARAMS["entry_lookback"]])


def test_costs_reduce_returns():
    bars, _ = data.get_ohlcv(seed=5, limit=400)
    sig = strategy.generate_signals(bars)
    free = backtest.run_backtest(bars, sig, fee_bps=0, slippage_bps=0)
    costed = backtest.run_backtest(bars, sig, fee_bps=20, slippage_bps=20)
    if free.n_trades > 0:
        assert costed.total_return < free.total_return, "costs must lower returns"


def test_verifier_rejects_random_walk():
    # Synthetic GBM has no edge; the checker must not pass it.
    bars, _ = data.get_ohlcv(seed=7, limit=1500)
    v = verifier.verify(bars, strategy.DEFAULT_PARAMS, n_trials=1)
    assert v.passed is False, "checker must reject a no-edge random walk"
    assert v.oos_summary is not None


def test_verifier_n_trials_raises_bar():
    bars, _ = data.get_ohlcv(seed=11, limit=1500)
    low = verifier.verify(bars, strategy.DEFAULT_PARAMS, n_trials=1)
    high = verifier.verify(bars, strategy.DEFAULT_PARAMS, n_trials=500)
    db_low = [g for g in low.gates if g.name == "deflated_sharpe"][0].detail
    db_high = [g for g in high.gates if g.name == "deflated_sharpe"][0].detail
    assert db_low != db_high, "deflated benchmark must scale with n_trials"


def test_paper_broker_roundtrip(tmp_path_factory=None):
    import tempfile, os
    d = tempfile.mkdtemp()
    sp = os.path.join(d, "acct.json")
    b = PaperBroker(sp, starting_cash=10_000, fee_bps=5, slippage_bps=5)
    b.rebalance(0.5, price=100.0, ts=1)
    assert b.acct.units > 0
    eq_after_buy = b.acct.equity
    b.flatten(price=100.0, ts=2)
    assert approx(b.acct.units, 0.0, 1e-9), "flatten must close the position"
    assert b.acct.equity < eq_after_buy  # paid fees/slippage
    b.save()
    b2 = PaperBroker(sp)  # reload
    assert approx(b2.acct.cash, b.acct.cash, 1e-6), "state must persist"


def test_risk_kill_switch():
    assert risk.check([100, 110, 80], max_drawdown=0.10).breached  # ~27% dd
    assert not risk.check([100, 101, 102], max_drawdown=0.10).breached


def test_three_way_split_is_chronological_and_disjoint():
    bars, _ = data.get_ohlcv(seed=2, limit=1000)
    s = three_way(bars, train_frac=0.5, validation_frac=0.25)
    assert len(s.train) + len(s.validation) + len(s.lockbox) == len(bars)
    # chronological: train precedes validation precedes lockbox
    assert s.train[-1].ts < s.validation[0].ts < s.lockbox[0].ts
    # lockbox is the most-recent slice
    assert s.lockbox[-1].ts == bars[-1].ts


def test_enforced_trial_counter_matches_grid_size():
    bars, _ = data.get_ohlcv(seed=4, limit=1000)
    s = three_way(bars)
    counter = TrialCounter()
    cands = grid_search(s.train, s.validation, counter)
    assert counter.n == len(expand_grid(DEFAULT_GRID)), "every candidate must tick the counter"
    assert len(cands) == counter.n
    # ranked best-first by validation sharpe
    assert all(cands[i].validation_sharpe >= cands[i + 1].validation_sharpe
               for i in range(len(cands) - 1))


def test_ledger_accumulates_trials_across_cycles():
    d = tempfile.mkdtemp()
    path = os.path.join(d, "ledger.json")
    led = ResearchLedger(path)
    led.add_trials(35)
    led.save()
    led2 = ResearchLedger(path)  # reload simulates next cycle
    led2.add_trials(35)
    assert led2.cumulative_trials == 70, "trial count must persist and accumulate"


def test_lockbox_is_write_once():
    bars, _ = data.get_ohlcv(seed=7, limit=1200)
    s = three_way(bars)
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "ledger.json"))
    first = verifier.verify_on_lockbox(s.lockbox, strategy.DEFAULT_PARAMS,
                                       n_trials=35, ledger=led, max_openings=1)
    assert first.blocked is False, "first open must be allowed"
    second = verifier.verify_on_lockbox(s.lockbox, strategy.DEFAULT_PARAMS,
                                        n_trials=35, ledger=led, max_openings=1)
    assert second.blocked is True, "re-opening the same lockbox must be blocked"
    assert second.passed is False


def test_lockbox_rejects_overfit_winner_on_noise():
    # Search the random walk, take the best-on-validation, open the lockbox once.
    bars, _ = data.get_ohlcv(seed=7, limit=1500)
    s = three_way(bars)
    counter = TrialCounter()
    cands = grid_search(s.train, s.validation, counter)
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "ledger.json"))
    led.add_trials(counter.n)
    v = verifier.verify_on_lockbox(s.lockbox, cands[0].params,
                                   n_trials=led.cumulative_trials, ledger=led)
    assert v.passed is False, "lockbox must reject an overfit winner on no-edge data"


def _run_all():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for fn in fns:
        fn()
        print(f"ok  {fn.__name__}")
        passed += 1
    print(f"\n{passed}/{len(fns)} tests passed")


if __name__ == "__main__":
    _run_all()
