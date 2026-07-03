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

## Primitives

- **Worktrees:** research experiments that mutate files (new strategy variants,
  parameter studies) run in an isolated git worktree per attempt, discarded on reject —
  so parallel experiments never collide. The frozen forward strategies are never edited
  in place (write-once registration).
- **MCP / connectors:** not required for this loop — data comes from read-only public
  price feeds (Coinbase, Coin Metrics). Any future connector is scoped read-only until trusted.
- **Safety & budget:** see [docs/safety.md](docs/safety.md) and `loop-budget.md`
  (token/compute caps, kill switches, trial-budget auto-halt).

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

4. **Research budget + auto-halt (`--trial-budget`).** `engine/ledger.py` halts
   searching once cumulative trials reach the budget — the alpha-spending cap that
   stops a forever-loop from turning all data into in-sample data. (#4 — done.)
5. **Forward quarantine (`--forward-test`).** `engine/quarantine.py` holds out the
   newest slice, researches on the earlier window, and forward-tests the survivor
   on data nothing touched. Approval requires research AND forward to pass; each
   forward window is spent after a few tests. The only verdict tuning can't game.
   (#5 — done.)

All five hardening steps are now implemented. The harness is "safe to run
unattended" in the research/paper sense.

**Strategy library (`--strategy`):** donchian (breakout), tsmom (time-series
momentum), meanrev (short-term reversion), regime (trend gated by calm vol),
mvrv (on-chain valuation contrarian), trendval (regime + MVRV euphoria brake).
On-chain investigation: neither MVRV formulation cleared the bar or improved the
best price strategy out-of-time — an honest negative (a compelling narrative is
not evidence).

**Multi-asset (`engine/xsectional.py` + `multi_data.py`):** cross-sectional
momentum over a 12-coin panel — the FIRST hypothesis with genuine statistical
signal (beats deflated Sharpe, PSR 1.0). Real, repeatable edge (PSR 1.0, beats deflated bar). Refinements under a
pre-registered 40% drawdown mandate: market-neutral long/short BACKFIRED (crypto
short leg is toxic — squeezes; momentum edge is long-only asymmetric); market-
trend risk-off (cash when BTC below trend) HELPED (drawdown 68%->44-47%, Sharpe
~1.2). Lands close to the 40% mandate (~43-47% DD out-of-sample) but does not
cleanly clear it. Stopped tweaking to avoid uncounted multiple testing.

**Survivorship correction:** expanded the 12 hand-picked survivors to a 32-coin
universe including real collapses (FTT/BTG/BSV/XVG, point-in-time eligibility).
Same strategy deflates: out-of-time Sharpe 1.09->0.78, drawdown 36%->51%, return
+691%->+304%. Survivorship inflated Sharpe ~30-40% and hid ~15pts of drawdown.
PSR stays 1.0 (signal is real) but it is a 51%-DD reject on a realistic universe —
and still an upper bound (truly delisted coins excluded). Real edge, honestly
deflated, not approvable.

**Forward paper trade (`engine/forward_paper.py`, pre-registered):** research is
over; the one real signal is FROZEN (write-once `forward-registration.json`) and
paper-traded forward — no re-optimization, forward equity is the verdict. A proper
loop: `--run --refresh` pulls latest prices and marks to market; the daily
`.github/workflows/quant-forward-track.yml` cron commits the forward P&L record.
Committed + live data both end 2026-05-23 so the record is "awaiting data" until
the source publishes new bars; an illustrative 2024–2025 replay lost money on
cross-sectional (~0.85x) but made +48% on regime — which is exactly why forward,
not backtest, decides. See PREREGISTRATION.md.

**Capstone — true out-of-time test** (research 2010–2020, forward 2020–2026, data
never touched by research/tuning): `regime` was the first to PASS honest research
(5/5 folds, 14% DD) but FAILED forward (37% DD). All strategies made big returns
2020–2026 (tsmom +531%) but with 37–41% drawdowns — beta to a bull market, not
alpha. Verdict: none approvable. The harness correctly refused to dress beta as
alpha. Real edge is the hard part; the loop just stops you fooling yourself.

Remaining work is strategy research (better hypotheses) and, as a separate gated
project, live execution.

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
