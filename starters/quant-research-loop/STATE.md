# Loop State — Quant Research Loop

Last updated: pre-registration baseline (forward tracker awaiting live data past 2026-05-23)

## Active loops

- **Forward paper trade** (`engine/service.py`, daily): two FROZEN strategies
  (`regime-trend`, `xsectional-momentum-riskoff`) marked to market. Status:
  `regime-trend` now sources a live Coinbase feed; `xsectional` still on the
  lagging Coin Metrics panel. Forward equity is the verdict.
- **Research gauntlet** (`engine/loop.py`): on demand — enforced trial counting,
  walk-forward, write-once lockbox, forward quarantine. No strategy approved.

## High priority (loop acting / waiting on human)

- Confirm `regime-trend` forward record populates from the live Coinbase feed on deploy.
- Wire a live basket feed for `xsectional` (survivorship-corrected panel can't come
  from a single exchange — forward can only hold listed coins).

## Watch list

- Modern-era edge is thin / regime-dependent (2021+ ≈ breakeven) — temper expectations.
- Next thesis: an intraday (hourly) strategy on the new Coinbase feed, or funding-rate carry.

## Recent

- Added live Coinbase (hourly+) data adapter; `regime-trend` sources it forward.

---
Run log: `quant-forward-log.md` + `loop-run-log.md` · budget: `loop-budget.md` · gates: `LOOP.md`
