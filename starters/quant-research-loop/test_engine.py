"""Smoke + correctness tests. Run: python3 -m pytest, or python3 test_engine.py

Stdlib only — no pytest required.
"""
from __future__ import annotations

import math

from engine import data, stats, strategy, backtest, verifier, risk
from engine.paper_broker import PaperBroker


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
