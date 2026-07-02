# Pre-Registration — Forward Paper Trade

This is a commitment device. The research phase found exactly one signal with real,
repeatable edge (cross-sectional momentum + market risk-off), honestly deflated by
survivorship to a ~51% drawdown. Rather than keep tuning until a backtest looks
good — the trap this whole project exists to expose — we FREEZE it here and let
forward time judge it.

## The frozen strategy

- **Signal:** long-only top-K cross-sectional momentum over a 32-coin universe
  (survivorship-corrected — includes FTT/BTG/BSV/XVG collapses).
- **Risk-off:** go to cash when BTC is below its 100-day trend.
- **Sizing:** portfolio volatility targeting at 40% annualized, no leverage.
- **Exact config & universe:** `forward-registration.json` (machine-readable, written once).

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
python3 -m engine.forward_paper --register     # freeze (already done; write-once)
python3 -m engine.forward_paper --run          # mark to market (schedule this)
python3 -m engine.forward_paper --since 2024-01-01   # illustrative replay (NOT the live record)
```
