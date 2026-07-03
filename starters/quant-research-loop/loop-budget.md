# Loop Budget — Quant Research Loop

## Compute / cost

- The forward tracker (`engine/service.py`) is pure stdlib. Cost per cycle ≈ one price
  fetch per strategy (Coinbase / Coin Metrics, free public endpoints) + a little CPU.
  Negligible; no paid APIs, no LLM calls at runtime.
- Research runs (walk-forward, cross-sectional) are CPU-bound minutes.

## Caps & kill switch

- **Check cadence:** `CHECK_INTERVAL_SECONDS` (default `86400` = daily) caps how often the
  tracker fetches prices.
- **Research budget:** enforced trial counting + `--trial-budget N` auto-halt
  (`engine/ledger.py`) stops searching once cumulative trials hit the cap — the
  alpha-spending cap that prevents grinding the data to dust.
- **Risk kill switch:** drawdown breaker (`engine/risk.py`); a forward mandate breach flags
  the thesis on the scoreboard.
- **Financial kill switch:** paper-only — no capital at risk, no live order path wired.
