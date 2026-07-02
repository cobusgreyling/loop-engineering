# Pre-Registration — Forward Paper Trade

This is a commitment device. The research phase found exactly one signal with real,
repeatable edge (cross-sectional momentum + market risk-off), honestly deflated by
survivorship to a ~51% drawdown. Rather than keep tuning until a backtest looks
good — the trap this whole project exists to expose — we FREEZE it here and let
forward time judge it.

## The frozen strategies

Two earned a forward test, registered write-once in `forward-registration.json`:

1. **`xsectional-momentum-riskoff`** — long-only top-K cross-sectional momentum over
   a 32-coin survivorship-corrected universe (incl. FTT/BTG/BSV/XVG collapses),
   with a BTC-trend risk-off to cash and 40% vol targeting. The signal with the
   highest raw edge (PSR 1.0) — but a ~51% corrected drawdown.
2. **`regime-trend`** — the humble single-asset BTC trend gated by a calm-vol
   regime, 40% vol targeting. Once survivorship is honestly accounted, it is the
   better RISK bet (~37% drawdown; on a 2024–25 illustrative replay it returned
   +48% at 27% drawdown while cross-sectional lost 15% at 48%).

Both are paper-traded forward in parallel; forward data decides which — if either —
holds up. Exact configs are in `forward-registration.json` (written once).

## The rules

1. **No re-optimization.** The config is frozen. `--run` only marks it to market.
2. **Registration is write-once.** Changing the strategy means registering a NEW
   hypothesis with a NEW start date — never editing this one after seeing results.
3. **Forward paper equity is the verdict**, not any backtest. Paper only; no live orders.
4. **Mandate:** max drawdown ≤ 40%. The corrected *historical* drawdown was ~51%
   (over mandate), so the honest expectation is that this is a stretch — forward
   data is the unbiased tiebreaker, not a foregone pass.

## Honest expectations

This is not a bet that the strategy will pass. It is a bet that we will find out
*honestly*. An illustrative replay of the frozen config on the recent 2024–2025
window lost money (≈0.85× equity, negative Sharpe, ~48% drawdown) — recent crypto
regimes have been hard for momentum. Forward trading tells the truth either way.

## Run it

```bash
python3 -m engine.forward_paper --register --strategy regime-trend   # freeze (write-once)
python3 -m engine.forward_paper --run                                # mark ALL to market (schedule this)
python3 -m engine.forward_paper --since 2024-01-01                   # illustrative replay (NOT the live record)
```
