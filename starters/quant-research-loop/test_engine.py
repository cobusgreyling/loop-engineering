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
from engine.walkforward import walk_forward
from engine.quarantine import forward_test


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


def test_real_sample_csv_runs_campaign():
    here = os.path.dirname(os.path.abspath(__file__))
    csvp = os.path.join(here, "sample-data", "btc_1d_coinmetrics.csv")
    if not os.path.exists(csvp):
        return  # snapshot optional — skip if absent
    bars = data.from_csv(csvp)
    assert len(bars) > 1000, "snapshot should hold years of daily bars"
    s = three_way(bars)
    counter = TrialCounter()
    cands = grid_search(s.train, s.validation, counter, periods_per_year=365)
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "l.json"))
    led.add_trials(counter.n)
    v = verifier.verify_on_lockbox(s.lockbox, cands[0].params,
                                   n_trials=led.cumulative_trials, ledger=led,
                                   periods_per_year=365)
    assert v.blocked is False and v.lockbox_summary is not None


def test_walkforward_structure_and_trial_count():
    bars, _ = data.get_ohlcv(seed=5, limit=1500)
    n_folds = 5
    wf = walk_forward(bars, n_folds=n_folds, periods_per_year=365)
    assert len(wf.folds) == n_folds
    # every fold re-searches the whole grid -> trials == folds * grid size
    assert wf.trials_this_run == n_folds * len(expand_grid(DEFAULT_GRID))
    assert wf.k_required == 3  # ceil(0.6 * 5)
    assert 0 <= wf.passes <= n_folds
    # in-sample (anchored) grows fold over fold
    assert wf.folds[0].is_bars < wf.folds[-1].is_bars


def test_walkforward_rejects_noise():
    bars, _ = data.get_ohlcv(seed=7, limit=1500)
    wf = walk_forward(bars, n_folds=5, periods_per_year=365)
    assert wf.passed is False, "walk-forward must reject a no-edge random walk"


def test_walkforward_trials_raise_deflated_bar():
    bars, _ = data.get_ohlcv(seed=9, limit=1500)
    low = walk_forward(bars, n_folds=5, n_trials_so_far=0, periods_per_year=365)
    high = walk_forward(bars, n_folds=5, n_trials_so_far=10_000, periods_per_year=365)
    assert high.deflated_benchmark > low.deflated_benchmark


def test_vol_target_positions_are_fractional_and_bounded():
    bars, _ = data.get_ohlcv(seed=4, limit=600)
    base = {"entry_lookback": 20, "exit_lookback": 10}
    vt = {**base, "vol_target": True, "target_vol": 0.40, "vol_lookback": 30, "max_leverage": 1.0}
    sig = strategy.generate_signals(bars, vt, periods_per_year=365)
    assert all(0.0 <= s <= 1.0 for s in sig), "positions bounded by max_leverage"
    assert any(0.0 < s < 1.0 for s in sig), "some fractional sizing must occur"
    raw = strategy.generate_signals(bars, base)
    for r, s in zip(raw, sig):  # vol target never enters when the breakout is flat
        if r == 0:
            assert s == 0.0


def test_vol_target_reduces_drawdown_on_real_btc():
    here = os.path.dirname(os.path.abspath(__file__))
    csvp = os.path.join(here, "sample-data", "btc_1d_coinmetrics.csv")
    if not os.path.exists(csvp):
        return
    bars = data.from_csv(csvp)
    base = {"entry_lookback": 20, "exit_lookback": 10}
    raw = backtest.run_backtest(bars, strategy.generate_signals(bars, base), periods_per_year=365)
    vt = backtest.run_backtest(
        bars, strategy.generate_signals(bars, {**base, "vol_target": True}, periods_per_year=365),
        periods_per_year=365)
    assert vt.max_drawdown < raw.max_drawdown, "vol targeting should cut drawdown"


def test_research_budget_halt():
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "l.json"))
    led.add_trials(120)
    assert led.budget_exhausted(100) is True
    assert led.budget_exhausted(200) is False
    assert led.budget_exhausted(0) is False  # 0 == unlimited


def test_forward_quarantine_is_spendable():
    bars, _ = data.get_ohlcv(seed=3, limit=400)
    fwd_bars = bars[-150:]
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "l.json"))
    params = {"entry_lookback": 20, "exit_lookback": 10}
    for i in range(3):  # max_evals=3 → 4th is blocked
        r = forward_test(fwd_bars, params, research_sharpe=1.0, ledger=led,
                         max_evals=3, min_forward_bars=60, periods_per_year=365)
        assert r.blocked is False
    blocked = forward_test(fwd_bars, params, research_sharpe=1.0, ledger=led,
                           max_evals=3, min_forward_bars=60, periods_per_year=365)
    assert blocked.blocked is True and blocked.passed is False


def test_forward_requires_enough_data():
    bars, _ = data.get_ohlcv(seed=8, limit=300)
    short_window = bars[-20:]  # below the floor
    led = ResearchLedger(os.path.join(tempfile.mkdtemp(), "l.json"))
    r = forward_test(short_window, {"entry_lookback": 20, "exit_lookback": 10},
                     research_sharpe=1.0, ledger=led, min_forward_bars=60,
                     periods_per_year=365)
    assert r.enough_data is False and r.passed is False


def test_all_strategies_produce_valid_signals():
    bars, _ = data.get_ohlcv(seed=6, limit=800)
    for name in strategy.STRATEGY_NAMES:
        params = {**strategy.default_params(name), "strategy": name}
        sig = strategy.generate_signals(bars, params)
        assert len(sig) == len(bars), f"{name}: length mismatch"
        assert all(s in (0, 1) for s in sig), f"{name}: raw signal must be 0/1"
        assert sig[0] == 0, f"{name}: must warm up flat"


def test_strategy_grids_are_small():
    # Degrees of freedom discipline: keep each grid modest.
    for name in strategy.STRATEGY_NAMES:
        combos = expand_grid(strategy.strategy_grid(name))
        assert 1 <= len(combos) <= 40, f"{name}: grid too large ({len(combos)})"


def test_meanrev_is_anticorrelated_with_trend():
    # Mean reversion should NOT just replicate the trend strategies — on a strong
    # uptrend it is often flat/late while tsmom is long.
    bars, _ = data.get_ohlcv(seed=1, limit=800, )
    mr = strategy.generate_signals(bars, {"strategy": "meanrev", **strategy.default_params("meanrev")})
    tm = strategy.generate_signals(bars, {"strategy": "tsmom", **strategy.default_params("tsmom")})
    assert mr != tm, "meanrev and tsmom must be distinct signals"


def test_onchain_features_flow_through_csv():
    here = os.path.dirname(os.path.abspath(__file__))
    csvp = os.path.join(here, "sample-data", "btc_1d_coinmetrics.csv")
    if not os.path.exists(csvp):
        return
    bars = data.from_csv(csvp)
    assert any("mvrv" in b.features for b in bars), "on-chain MVRV must load from CSV"


def test_mvrv_brake_changes_trend_signal():
    here = os.path.dirname(os.path.abspath(__file__))
    csvp = os.path.join(here, "sample-data", "btc_1d_coinmetrics.csv")
    if not os.path.exists(csvp):
        return
    bars = data.from_csv(csvp)
    base = {"trend_lookback": 100, "vol_regime_lookback": 30}
    reg = strategy.generate_signals(bars, {"strategy": "regime", **base})
    tv = strategy.generate_signals(bars, {"strategy": "trendval", **base, "mvrv_ceiling": 2.5})
    assert reg != tv, "the MVRV euphoria brake must actually change the signal"


def test_xsectional_panel_and_walkforward():
    here = os.path.dirname(os.path.abspath(__file__))
    p = os.path.join(here, "sample-data", "crypto_panel.csv")
    if not os.path.exists(p):
        return
    from engine import multi_data as md
    from engine import xsectional as xs
    dates, series, assets = md.panel_from_csv(p)
    assert len(assets) >= 8 and len(dates) > 2000
    cols = md.as_matrix(dates, series, assets)
    rets = xs.portfolio_returns(dates, cols, xs.DEFAULT_PARAMS)
    assert len(rets) == len(dates) - 1
    r = xs.walk_forward(dates, cols, n_folds=5)
    assert len(r.folds) == 5
    assert r.trials == 5 * len(xs.expand_grid(xs.DEFAULT_GRID)), "trials must be counted"


def test_xsectional_vol_target_changes_returns():
    import math
    from engine import xsectional as xs
    dates = list(range(1_600_000_000, 1_600_000_000 + 400 * 86400, 86400))

    def path(drift, amp):
        p = [100.0]
        for i in range(1, len(dates)):
            p.append(p[-1] * (1.0 + drift + amp * math.sin(i)))  # trend + real variance
        return p
    cols = {"a": path(0.01, 0.03), "b": path(0.0, 0.02), "c": path(-0.005, 0.02)}
    base = {"lookback": 30, "top_k": 1, "rebalance": 30}
    raw = xs.portfolio_returns(dates, cols, base)
    # A tight target (0.1) is well below the basket's realized vol, so the overlay
    # must scale exposure below 1.0 and change the stream.
    vt = xs.portfolio_returns(dates, cols, {**base, "vol_target": True, "target_vol": 0.1})
    assert raw != vt, "vol targeting must change the portfolio return stream"


def test_xsectional_overlays_change_returns():
    here = os.path.dirname(os.path.abspath(__file__))
    p = os.path.join(here, "sample-data", "crypto_panel.csv")
    if not os.path.exists(p):
        return
    from engine import multi_data as md
    from engine import xsectional as xs
    dates, series, assets = md.panel_from_csv(p)
    cols = md.as_matrix(dates, series, assets)
    base = {"lookback": 60, "top_k": 3, "rebalance": 30}
    plain = xs.portfolio_returns(dates, cols, base)
    mkt = xs.portfolio_returns(dates, cols, {**base, "market_filter": True})
    ls = xs.portfolio_returns(dates, cols, {**base, "long_short": True})
    assert plain != mkt, "market-trend risk-off filter must change returns"
    assert plain != ls, "long/short leg must change returns"


def test_expanded_panel_includes_collapses():
    here = os.path.dirname(os.path.abspath(__file__))
    p = os.path.join(here, "sample-data", "crypto_panel_expanded.csv")
    if not os.path.exists(p):
        return
    from engine import multi_data as md
    dates, series, assets = md.panel_from_csv(p)
    assert len(assets) >= 25, "expanded universe should be much larger than the 12 survivors"
    # A survivorship-relevant coin (FTT) must show a real collapse in the data.
    ftt = series.get("ftt", {})
    if ftt:
        items = sorted(ftt.items())
        peak = max(v for _, v in items)
        last = items[-1][1]
        assert peak / last > 10, "FTT must show its collapse (peak >> last)"


def test_forward_paper_registry_and_metrics():
    import calendar
    import datetime as _dt
    from engine import forward_paper as fp
    here = os.path.dirname(os.path.abspath(__file__))
    assert set(fp.FROZEN_STRATEGIES) >= {"xsectional-momentum-riskoff", "regime-trend"}
    since = calendar.timegm(_dt.datetime(2022, 1, 1).timetuple())
    # both frozen kinds (single_asset + xsectional) produce sane read-only metrics
    for name, entry in fp.FROZEN_STRATEGIES.items():
        if not os.path.exists(os.path.join(here, "sample-data", entry["data"])):
            continue
        m = fp._metrics(entry, since)
        assert m["n_days"] > 100, f"{name}: expected forward days"
        assert set(m) >= {"sharpe", "max_drawdown", "current_drawdown", "equity_mult"}


def test_blotter_reconciles_to_backtest_equity():
    from engine import blotter
    bars, _ = data.get_ohlcv(seed=5, limit=800)
    sig = strategy.generate_signals(bars, {"entry_lookback": 20, "exit_lookback": 10})
    res = backtest.run_backtest(bars, sig, periods_per_year=365)
    trades = blotter.extract_trades(bars, sig)
    prod = 1.0
    for t in trades:
        prod *= (1.0 + t.net_return)  # full precision
    assert abs(prod - res.equity[-1]) < 1e-9, "trade PnLs must reconcile to backtest equity"


def test_blotter_detects_one_round_trip():
    from engine import blotter
    from engine.data import Bar
    # flat, then a clean long span (up 20%), then flat again
    prices = [100, 100, 100, 110, 121, 121]  # entry at idx2 close, exit at idx4->flat
    bars = [Bar(ts=1_600_000_000 + i * 86400, open=p, high=p, low=p, close=p, volume=0)
            for i, p in enumerate(prices)]
    sig = [0, 0, 1, 1, 0, 0]
    trades = blotter.extract_trades(bars, sig, fee_bps=0, slippage_bps=0)
    closed = [t for t in trades if t.status == "closed"]
    assert len(closed) == 1
    assert closed[0].net_return > 0.19  # ~ (110->121) held, ~21% ish, positive


def test_xsec_blotter_reconciles_to_portfolio_returns():
    here = os.path.dirname(os.path.abspath(__file__))
    p = os.path.join(here, "sample-data", "crypto_panel_expanded.csv")
    if not os.path.exists(p):
        return
    from engine import multi_data as md
    from engine import xsectional as xs
    dates, series, assets = md.panel_from_csv(p)
    cols = md.as_matrix(dates, series, assets)
    cfg = {"lookback": 90, "top_k": 5, "rebalance": 30, "market_filter": True,
           "market_trend_n": 100, "vol_target": True, "target_vol": 0.40, "vol_lookback": 30}
    rets = xs.portfolio_returns(dates, cols, cfg)
    trades, total_costs = xs.portfolio_trades(dates, cols, cfg)
    recon = sum(t.contribution for t in trades) - total_costs
    assert abs(recon - sum(rets)) < 1e-9, "per-coin contributions must reconcile to portfolio returns"


def test_blotter_marks_open_trade():
    from engine import blotter
    from engine.data import Bar
    prices = [100, 100, 110, 120]
    bars = [Bar(ts=1_600_000_000 + i * 86400, open=p, high=p, low=p, close=p, volume=0)
            for i, p in enumerate(prices)]
    sig = [0, 1, 1, 1]  # never returns to flat
    trades = blotter.extract_trades(bars, sig, fee_bps=0, slippage_bps=0)
    assert trades[-1].status == "open"


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
