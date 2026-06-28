# Quant Research Loop Starter (Crypto · Paper)

The five-stage autonomous trading loop from the viral *"loop engineering for
quant"* article — rebuilt the way this repo insists it should be:
**report-first, paper-only, and with a verifier that is real math, not an LLM
opining on a backtest.**

> The article's fatal flaw: it framed the "verifier" as a second agent asked
> whether a backtest looks good. But a backtest's failure mode is **overfitting**,
> and you cannot catch overfitting with a second opinion. This starter's checker
> is numerical and non-overridable. That is the whole point.

Zero dependencies. Pure Python stdlib. Runs offline on deterministic synthetic
data, or on a real feed when you have one.

## Quick Start

```bash
cd starters/quant-research-loop

# Run one full cycle on synthetic data (no keys, no network):
python3 -m engine.loop --once

# Read the decision the loop made:
cat quant-state.md
```

You'll see the maker propose a position, the checker judge it **out-of-sample**,
and — on random-walk synthetic data — correctly **REJECT and refuse to trade**.
That refusal is the feature.

### What we trade

Starting target: **BTC/USDT · spot · daily (1d) bars.**

- **BTC/USDT** — deepest liquidity, so the 5bps fee + 5bps slippage assumption is
  realistic, not optimistic; most free history for the lockbox.
- **Spot** — no funding, leverage, or liquidation. The example strategy is
  long/flat only, so perps add risk and buy nothing yet.
- **Daily bars** — the Donchian 20/55 breakout *is* the classic Turtle system,
  designed for daily. On 1h a "55" channel is ~2 days of noise.

`--timeframe` also sets Sharpe annualization (1d→365, 4h→2190, 1h→8760); using
the wrong one silently inflates every Sharpe.

### Real data

```bash
# Real BTC daily price history (Coin Metrics community data, no key):
python3 -m engine.loop --search --source coinmetrics --symbol BTCUSDT --timeframe 1d --limit 0

# A committed snapshot also runs offline / in CI:
python3 -m engine.loop --search --csv sample-data/btc_1d_coinmetrics.csv --timeframe 1d --limit 0

# Full OHLCV from an exchange (on your own machine):
python3 -m engine.loop --search --source live --symbol BTCUSDT --timeframe 1d
```

Three real-data notes:

- **`coinmetrics`** pulls a daily *reference price* (close), not OHLC, so the
  breakout runs as **Donchian-on-close** — a standard daily variant. It works
  even behind a restrictive network policy (`raw.githubusercontent.com`).
- **`live`** (Binance) gives true OHLCV but is **geo-blocked in the US** — point
  `data.py` at Binance.US or Coinbase (same shape, one-function change).
- The bundled snapshot `sample-data/btc_1d_coinmetrics.csv` is BTC daily
  ~2010–2020. Early BTC had tiny prices and violent moves, which flatters returns
  — a data-quality caveat the verifier's drawdown + deflated gates partly absorb.

**What it teaches on real BTC:** the Turtle 20/10 breakout shows validation
Sharpe ~2.4 and a +335% lockbox return — yet the lockbox **REJECTS** it, because
after the 35-config search penalty (deflated Sharpe) and a 47% drawdown it
doesn't clear the honest bar. A naive backtest ships it; the lockbox doesn't.

### Be honest about your search

```bash
# If you grid-searched 200 parameter sets, say so — the bar rises accordingly:
python3 -m engine.loop --once --n-trials 200
```

### Campaign mode — automated search you can't fool yourself with

`--search` turns "find a strategy" into a loop. It is built so that being *less
in the loop* does not mean *less honest*. Two structural guards do the accounting
you can no longer do by hand:

```bash
python3 -m engine.loop --search          # grid-search + lockbox, one campaign cycle
```

1. **Enforced trial counting (`engine/search.py` + `ledger.py`).** Every candidate
   the grid evaluates ticks a counter. That count is persisted in
   `research-ledger.json` and *accumulates across cycles*, then feeds the deflated
   Sharpe gate. You cannot search 1,000 configs and claim you tried one — the loop
   counts for you, forever.
2. **Three-way split + write-once lockbox (`engine/split.py` + `ledger.py`).**
   Data is split `train` / `validation` / `lockbox`. The search optimizes on
   train, ranks on validation, and the **lockbox is opened exactly once, on the
   winner only.** A second peek at the same lockbox is BLOCKED — re-peeking is
   self-deception, so the loop refuses.

What that looks like across three cycles on synthetic (no-edge) data:

| Cycle | Data | Validation Sharpe | Lockbox verdict |
|-------|------|-------------------|-----------------|
| 1 | seed 7 | **6.27** (overfit!) | **REJECT** (lockbox Sharpe −9.22) |
| 2 | seed 7 (same) | — | **BLOCKED** (lockbox already spent) |
| 3 | seed 42 (fresh) | … | REJECT (deflated bar now higher — 105 cumulative trials) |

The search *will* find a beautiful in-sample winner. The lockbox is what stops
you from believing it.

### Walk-forward mode — does it generalize across regimes?

`--walkforward` is the stronger #3 test. Instead of one holdout, it re-optimizes
on a rolling in-sample window and scores each *next* out-of-sample fold, across
the whole history. A strategy must clear **two** gates:

```bash
python3 -m engine.loop --walkforward --csv sample-data/btc_1d_coinmetrics.csv \
        --timeframe 1d --limit 0 --folds 5
```

- **Consistency (K-of-N):** at least K folds clear a per-fold gate (Sharpe floor +
  drawdown cap). A strategy that only worked in 2017 fails here.
- **Aggregate honesty:** pool every fold's OOS returns and require the combined
  curve to beat the deflated benchmark for *all* trials (N folds × grid), clear
  PSR ≥ 0.95, and stay under the drawdown cap.

On real BTC daily this is where the Turtle breakout truly dies — and *why* matters:

| | result |
|---|---|
| Pooled OOS Sharpe | **1.91** (beats deflated bar 1.14, PSR 1.0) |
| Consistency | **2/5 folds** passed (need 3) |
| Verdict | **REJECT** |

The aggregate looks like a winner. But 3 of 5 folds had **36–65% drawdowns** —
the strategy isn't robust, it's just been lucky in a couple of regimes. An
aggregate-only test green-lights it; the K-of-N gate vetoes it. That disagreement
is the point.

### Trying to BEAT the verifier — volatility targeting

The breakout fails on *drawdown*, not signal (its OOS Sharpes are strong). The
classic fix is `--vol-target`: size the position by `target_vol / realized_vol`,
so you hold less in violent regimes and more in calm ones (capped at
`--max-leverage`, default 1.0 = spot, no borrow). Walk-forward, real BTC daily:

| | Raw breakout | Vol-targeted (40%) |
|---|---|---|
| Consistency | 2/5 folds | **5/5 folds** |
| Pooled OOS Sharpe | 1.91 | **2.34** |
| Pooled drawdown | 65% | **28%** |

A real, structural win — every fold passes, Sharpe *rises*, worst drawdown halves
— because lower risk targeting generalizes to any future data, it is not
curve-fit. Yet at the a-priori default (40%) it is **still REJECTED**, by 3
points on the aggregate drawdown cap (28% vs 25%).

> **The honest trap, on display.** A lower target (`--target-vol 0.30`) *does*
> pass. But sweeping `target_vol` by hand and reporting the value that clears the
> gate is **uncounted multiple testing** — the enforced counter tracks the grid,
> not your own experimentation. Picking the setting that passes *after* seeing the
> result is exactly the self-deception this engine guards against, one level up.
> The only judge that cannot be gamed this way is data none of these experiments
> touched — i.e. forward testing (below). A passing backtest is a hypothesis,
> never a verdict.

### Forward quarantine — the one judge you can't game (#5)

`--forward-test` carves the newest slice of history into a **quarantine window**
that the search, walk-forward, and lockbox never touch. It researches on the
earlier window, then forward-tests the survivor on the held-out tail. Forward
performance — not any backtest — gates capital.

```bash
python3 -m engine.loop --forward-test --csv sample-data/btc_1d_coinmetrics.csv \
        --timeframe 1d --limit 0 --vol-target --forward-frac 0.2
```

Real BTC, vol-targeted breakout at the principled 0.40 default:

| Stage | Verdict |
|---|---|
| Research (walk-forward, early 80%) | **REJECT** |
| Forward (out-of-time, last 20%) | **PASS** — Sharpe 1.38, +94%, 18% DD |
| **Approved for capital** | **NO** |

The forward window — which *cannot* be tuned against — actually validated the
strategy cleanly. Yet it is **not approved**, because approval requires research
*and* forward to pass, and honest research (0.40, not the cherry-picked 0.30)
rejected it. No single lucky result is sufficient. Like the lockbox, each forward
window is **spent** after a few tests (`--max-forward-evals`) — forward-testing
100 strategies on the same tail just relocates the multiple-testing problem.

### Research budget + auto-halt (#4)

`--trial-budget N` makes the loop **stop searching** once cumulative trials reach
N. An autonomous loop that searches forever slowly turns the entire dataset into
in-sample data; the budget is the alpha-spending cap that forces a stop.

```bash
python3 -m engine.loop --walkforward --csv sample-data/btc_1d_coinmetrics.csv \
        --timeframe 1d --limit 0 --trial-budget 100
# run again → HALTED: "175 trials >= budget 100. Stop searching."
```

The budget is checked before each run (a single run may overshoot); once spent,
further searches halt and point you to forward-testing or new data.

## The five stages (mapped to loop-engineering primitives)

| Stage | Primitive | Module |
|-------|-----------|--------|
| 1. Data ingestion | Automation | `engine/data.py` |
| 2. Signal generation (maker) | Sub-agent | `engine/strategy.py` |
| 3. Verification (checker) | Sub-agent / verifier | `engine/verifier.py` |
| 4. Execution (**paper only**) | Connector | `engine/paper_broker.py` |
| 5. Risk monitoring | Kill switch | `engine/risk.py` |
| Orchestration + memory | State | `engine/loop.py` → `quant-state.md` |

## What's included

| File | Purpose |
|------|---------|
| `engine/` | Runnable five-stage loop (stdlib only) |
| `engine/verifier.py` | OOS gates + lockbox verdict: deflated Sharpe, PSR, drawdown |
| `engine/search.py` | Grid search with enforced trial counting |
| `engine/walkforward.py` | Walk-forward K-of-N rolling out-of-sample validation |
| `engine/quarantine.py` | Forward out-of-time test; the verdict that gates capital |
| `engine/split.py` | Three-way train/validation/lockbox split |
| `engine/ledger.py` | Trial counter + budget + write-once lockbox/forward ledger |
| `engine/stats.py` | Overfitting-aware metrics (no numpy/scipy) |
| `skills/alpha-research/SKILL.md` | Maker procedure manual |
| `skills/backtest-verifier/SKILL.md` | Checker procedure manual |
| `quant-state.md.example` | State spine template |
| `sample-data/btc_1d_coinmetrics.csv` | Real BTC daily snapshot (~2010–2020) for offline runs |
| `LOOP.md` | Cadence, gates, budget, phased rollout |
| `test_engine.py` | Smoke + correctness tests |

## What this does NOT do

- **It does not place real orders.** `paper_broker.py` has no credentials. Going
  live is a separate, explicitly human-gated project — see `LOOP.md`.
- **It does not manufacture alpha.** The loop is plumbing. The example Donchian
  strategy is a teaching baseline, not edge. The honest deliverable is the
  *discipline*: out-of-sample, cost-aware, multiple-testing-penalized verification.

## Honest expectations

> Two people can run the same loop and get opposite results. The loop doesn't
> know. You do. — this repo's README

A self-running research loop makes you *faster and more disciplined* at killing
bad ideas. It does not make you Renaissance. Their edge is data, execution
infrastructure, and rigor — the loop is the cheap part everyone can copy.

## Next steps

- [docs/safety.md](../../docs/safety.md) · [docs/failure-modes.md](../../docs/failure-modes.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- Swap in your own hypothesis in `engine/strategy.py`; keep the verifier strict.
