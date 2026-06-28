# Loop Configuration — Quant Research (Crypto, Paper)

The five-stage trading loop from the viral "loop engineering for quant" article,
rebuilt the way this repo insists: **report-first, paper-only, with a real
numerical checker** instead of an LLM that opines on backtests.

**Trading target:** BTC/USDT · spot · daily (1d) bars. Single most-liquid pair
keeps cost assumptions realistic; spot avoids funding/leverage/liquidation; daily
matches the Donchian 20/55 (Turtle) breakout. `--timeframe` sets bar size AND
Sharpe annualization together.

**Data sources:** `coinmetrics` (real daily close, works behind egress policy,
bundled snapshot in `sample-data/`), `live` (Binance OHLCV — US-blocked, use
Binance.US/Coinbase locally), or `--csv` your own OHLCV.

## Active Loops

| Stage | Primitive | Cadence | Status | Module |
|-------|-----------|---------|--------|--------|
| Ingest | Automation | 1h (data dependent) | L1 | `engine/data.py` |
| Signal | Maker sub-agent | on data update | L1 | `engine/strategy.py` |
| Verify | Checker sub-agent | per signal | **gate** | `engine/verifier.py` |
| Execute | Connector | per verified signal | **L1 paper-only** | `engine/paper_broker.py` |
| Risk | Kill switch | every cycle | always on | `engine/risk.py` |

## Human Gates

- **Live trading is NOT wired and will not be added without explicit sign-off.**
  `paper_broker.py` has no exchange credentials and places zero real orders.
- Going live requires, at minimum: an order-execution connector behind an
  allowlist, position + notional caps, a separate live kill-switch process, and
  a human approving the switch. Treat that as a different project.
- A REJECT from the checker is final for that cycle. The maker forms a new
  hypothesis; it does not argue with the numbers.

## Anti-overfitting gates (the actual edge of this starter)

- Verdicts are judged **out-of-sample**, never in-sample.
- Sharpe must beat the **deflated benchmark** for the honest `n_trials`.
- **Probabilistic Sharpe >= 0.95** — the result must be distinguishable from noise.
- Every "lesson learned" appended to a skill is a **hypothesis to re-test**, not
  an in-sample patch. Self-improving must not become self-overfitting.

### Campaign mode (`--search`) — automated search, kept honest

Because an auto-search loop can no longer rely on you to count how many ideas it
tried, two guards do the accounting structurally:

1. **Enforced trial counting.** `engine/search.py` ticks a counter per candidate;
   `engine/ledger.py` persists it in `research-ledger.json` and accumulates it
   across cycles. The deflated Sharpe gate consumes the cumulative count — the bar
   rises with everything ever searched. (Roadmap #1 — done.)
2. **Write-once lockbox.** `engine/split.py` splits train/validation/lockbox; the
   lockbox is opened once on the winner only. The ledger fingerprints it and
   BLOCKS any re-open. A BLOCKED verdict means "get fresh data or forward-test."
   (Roadmap #2 — done.)

3. **Walk-forward K-of-N (`--walkforward`).** `engine/walkforward.py` re-optimizes
   on a rolling in-sample window and scores each next OOS fold; requires K-of-N
   folds to pass AND the pooled OOS curve to clear deflated/PSR/drawdown. Catches
   strategies that only worked in one regime — which a single lockbox can miss.
   (Roadmap #3 — done.)

**Strategy overlay — volatility targeting (`--vol-target`).** Sizes the position
by target_vol/realized_vol so risk is roughly constant; `engine/strategy.py`.
Transforms the breakout on real BTC (drawdown 65%→28%, 5/5 walk-forward folds)
but still misses the aggregate drawdown cap by 3pts at the principled 0.40
default. Lower targets pass — but choosing one post-hoc is uncounted multiple
testing, so the real test is forward data (#5), not a re-run.

Still ahead: cumulative research budget + halt (#4), forward paper-trade
quarantine (#5).

## Budget & Observability

- Run log: `quant-run-log.md` (appended each cycle)
- Live state: `quant-state.md`
- Paper account: `paper-account.json`
- Kill switch: drawdown breaker in `risk.py`; set `--kill-drawdown`.

## Phased rollout

1. **L1 (now):** synthetic/CSV data, paper execution, read `quant-state.md`.
2. **L2:** live read-only data feed, paper execution, multi-split walk-forward.
3. **L3 (separate sign-off):** live execution behind allowlist + caps + human gate.

## Links

- Maker skill: `skills/alpha-research/SKILL.md`
- Checker skill: `skills/backtest-verifier/SKILL.md`
- Repo safety: [docs/safety.md](../../docs/safety.md) · [docs/failure-modes.md](../../docs/failure-modes.md)
