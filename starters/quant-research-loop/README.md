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
- The bundled snapshot `sample-data/btc_1d_coinmetrics.csv` is BTC daily close
  **2010–2026** (fetched in chunks via HTTP Range to defeat the egress size cap).
  Early BTC had tiny prices and violent moves, which flatters returns — a
  data-quality caveat the verifier's drawdown + deflated gates partly absorb.

**What it teaches on real BTC:** every simple strategy here either fails honest
research or, if it passes, fails the true out-of-time test on 2020–2026 — see the
[capstone](#capstone--the-true-out-of-time-test). A naive backtest ships a +531%
bull-market ride; the gates see beta with too much drawdown and say no.

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

On real BTC daily (2010–2026 snapshot) this is where the Turtle breakout dies:

| | result |
|---|---|
| Pooled OOS Sharpe | 1.24 |
| Consistency | **1/5 folds** passed (need 3) |
| Pooled drawdown | **65%** |
| Verdict | **REJECT** |

Most folds carry 40–65% drawdowns — the breakout isn't robust, it just rode a
couple of huge trends. The K-of-N consistency gate vetoes it even where the
pooled number flatters it. (All real-BTC numbers here use the committed
`sample-data/btc_1d_coinmetrics.csv`, daily close 2010–2026.)

### Trying to BEAT the verifier — volatility targeting

The breakout fails on *drawdown*, not signal (its OOS Sharpes are strong). The
classic fix is `--vol-target`: size the position by `target_vol / realized_vol`,
so you hold less in violent regimes and more in calm ones (capped at
`--max-leverage`, default 1.0 = spot, no borrow). Walk-forward, real BTC daily:

| | Raw breakout | Vol-targeted (40%) |
|---|---|---|
| Consistency | 1/5 folds | **3/5 folds** |
| Pooled OOS Sharpe | 1.24 | 1.30 |
| Pooled drawdown | 65% | **42%** |

A real, structural win — more folds pass and the worst drawdown drops sharply —
because lower risk targeting generalizes to any future data, it is not curve-fit.
Yet it is **still REJECTED**: 42% pooled drawdown is far over the 25% cap.

> **The honest trap.** A lower `--target-vol` cuts drawdown further and a value
> exists that clears the gate. But sweeping `target_vol` by hand and reporting the
> one that passes is **uncounted multiple testing** — the enforced counter tracks
> the grid, not your own experimentation. Picking the setting that passes *after*
> seeing the result is the self-deception this engine guards against, one level
> up. The only judge that cannot be gamed this way is data none of these
> experiments touched — forward testing (below). A passing backtest is a
> hypothesis, never a verdict.

### Forward quarantine — the one judge you can't game (#5)

`--forward-test` carves the newest slice of history into a **quarantine window**
that the search, walk-forward, and lockbox never touch. It researches on the
earlier window, then forward-tests the survivor on the held-out tail. Forward
performance — not any backtest — gates capital.

```bash
# research on 2010-2020, forward-test the survivor on UNSEEN 2020-2026:
python3 -m engine.loop --forward-test --csv sample-data/btc_1d_coinmetrics.csv \
        --timeframe 1d --limit 0 --strategy regime --vol-target --forward-frac 0.4
```

Approval requires research *and* forward to pass. Each forward window is **spent**
after a few tests (`--max-forward-evals`) — forward-testing 100 strategies on the
same tail just relocates the multiple-testing problem. See the capstone result
below.

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
| `sample-data/btc_1d_coinmetrics.csv` | Real BTC daily snapshot (2010–2026) for offline runs |
| `LOOP.md` | Cadence, gates, budget, phased rollout |
| `test_engine.py` | Smoke + correctness tests |

## Capstone — the true out-of-time test

Four hypotheses, each researched on **2010–2020** and then forward-tested on
**2020–2026, data none of the research, tuning, or bake-off ever touched**
(`--forward-frac 0.4`, vol-targeted):

| Strategy | Research 2010–2020 | Forward 2020–2026 (unseen) | Approved |
|---|---|---|---|
| **regime** | **PASS** (5/5, DD 14%) | **REJECT** — Sharpe 0.82, +161%, DD 37% | NO |
| donchian | REJECT (DD 28%) | REJECT — Sharpe 0.98, +286%, DD 41% | NO |
| tsmom | REJECT (DD 40%) | REJECT — Sharpe 1.15, **+531%**, DD 39% | NO |
| meanrev | REJECT (0/5, DD 76%) | REJECT — Sharpe 0.17, +7%, DD 38% | NO |

This is the whole project in one table:

- **`regime` was the first strategy ever to PASS honest research** (5/5 walk-forward
  folds, 14% pooled drawdown) — and it still **failed on genuinely unseen
  2020–2026 data** (37% drawdown). *Research success did not survive out-of-time.*
  That is the single most valuable thing the harness can tell you.
- **Every strategy made big returns 2020–2026** (tsmom +531%!) — because BTC rose.
  But all carried 37–41% drawdowns and sub-bar Sharpes. **That's beta to a bull
  market, not alpha.** A naive backtest sees +531% and bets the house; the gates
  see leverage on a rising tide and say no.
- **`meanrev` is dead** — buying dips catches falling knives (as predicted).
- The trend family is **correlated** — variations on one bet.

The honest verdict: **none of these simple strategies is approvable.** That is not
failure — it is the harness doing its job, stopping you from deploying beta dressed
as alpha. Finding real edge is the genuinely hard part; the loop just makes sure
you don't fool yourself about whether you've found it.

### On-chain investigation (orthogonal to price)

Everything above is price/trend. The natural next step is a *genuinely orthogonal*
signal — on-chain valuation. The data layer carries Coin Metrics features
(`mvrv`, `adract`, `txcnt`) alongside price, and two hypotheses use MVRV
(market value ÷ realized value = price vs the network's aggregate cost basis):

- **`mvrv`** — contrarian valuation timing (long when cheap vs its trailing
  median, exit when rich). **Result: bad.** 0/5 walk-forward, 65–81% drawdowns —
  "cheap" MVRV in a crash gets cheaper, so it buys falling knives and holds down.
  Real information, used badly.
- **`trendval`** — trend + calm-vol regime, PLUS an MVRV *euphoria brake* (step
  aside when MVRV > ceiling = top risk). This is the principled use: orthogonal
  info attacking the drawdown constraint. The brake is wired and fires on ~18% of
  days — but out-of-time it produced **the same 37% drawdown as plain regime.**
  The on-chain signal did not add measurable edge in the true test.

Honest negative result: on-chain valuation *sounds* like it must help, but neither
formulation cleared the bar or improved the best price strategy out-of-time. That
is exactly why the harness exists — a compelling narrative is not evidence. (Note:
this is now 6 strategies tested; chasing MVRV variants until one passes would be
the same multiple-testing trap, one level up.)

### Cross-sectional momentum (multi-asset — first REAL signal)

Everything above is single-asset (long-biased beta). Cross-sectional momentum is
different: rank a 12-coin universe by trailing return, hold the top-K equally
weighted, rebalance. It is a bet on *relative* strength — orthogonal to market
direction. Code: `engine/multi_data.py` (panel loader) + `engine/xsectional.py`
(portfolio + its own walk-forward), data `sample-data/crypto_panel.csv`.

| | Raw | + vol target (50%) |
|---|---|---|
| Pooled OOS Sharpe | 0.99 | 0.93 |
| Beats deflated bar? | **yes** (0.99 > 0.79) | **yes** |
| PSR | **1.00** | **1.00** |
| Pooled drawdown | 93% | 77% |
| Verdict | REJECT | REJECT |

**This is the first hypothesis with genuine statistical signal** — it clears the
deflated-Sharpe and PSR gates that every trend/on-chain strategy failed. Cross-
sectional momentum *has edge*. But it is rejected on **drawdown**: even vol-
targeted, momentum crashes (winners reverse together) drive 42–77% drawdowns, far
over the 25% cap.

> **Two honest caveats that matter more than the Sharpe.**
> 1. **Survivorship bias.** The universe is coins that *survived* to 2026. Every
>    dead coin and −99% rug is absent, and a real strategy would have bought some.
>    This inflates the result and the forward test *cannot* fix it (it is baked
>    into the universe, not the time split). Treat the numbers as an upper bound.
> 2. **The 25% drawdown cap is a risk preference, not a law.** Buy-and-hold BTC
>    draws down 80%+. A crypto strategy at ~45% drawdown and Sharpe ~1 may be
>    genuinely good *by crypto standards* — but relaxing the cap to force a pass,
>    after seeing the result, is goalpost-moving. That call belongs to a
>    pre-registered mandate, not to hindsight.

#### Refining the cross-sectional signal (40% mandate)

With the drawdown cap pre-registered at **40%**, two refinements were tested:

- **Market-neutral long/short** (short the weakest coins): **backfired hard** —
  Sharpe 0.96 → 0.07, forward −62%. Crypto's short leg is toxic: the weakest
  coins violently short-squeeze. Momentum's edge is asymmetric, living entirely
  in the long winners. A reasonable idea the data killed.
- **Market-trend risk-off** (go to cash when BTC is below its trend SMA):
  **helped a lot** — drawdown 68% → 44-47%, walk-forward Sharpe up to ~1.2, PSR
  1.0. Out-of-time it posted Sharpe ~1.1 / 36% DD on 2020-2026, but ~43-47% DD
  across a modern-era study — **just over the 40% mandate.**

**Honest landing:** cross-sectional momentum + market risk-off + vol targeting is
the first thing with real, repeatable edge (PSR 1.0, beats the deflated bar), and
it lands *close to* a 40% drawdown mandate but does not cleanly clear it out-of-
sample. Continuing to tweak knobs until one clears 40% would be uncounted
multiple testing — the trap this whole engine exists to expose.

#### Survivorship, corrected (the result deflates)

The 12-coin universe was hand-picked survivors. The honest fix: expand to a
32-coin universe including coins that pumped and **collapsed** — FTT (−100% in the
FTX blowup), BTG (−100%), BSV (−97%), XVG (−99%) — with point-in-time eligibility
(a coin is only rankable on days it has a price). Same strategy, both universes:

| | Survivor-12 (flattered) | Expanded-32 (corrected) |
|---|---|---|
| Walk-forward Sharpe | 1.28 | **0.94** |
| Consistency | 4/5 | **2/5** |
| Out-of-time Sharpe | 1.09 | **0.78** |
| Out-of-time drawdown | 36% | **51%** |
| Out-of-time return | +691% | +304% |

Survivorship inflated Sharpe ~30-40% and hid ~15 points of drawdown. Momentum
*did* buy the collapses and eat them. The strategy that looked borderline on a 40%
mandate is, on a realistic universe, a **51%-drawdown reject.** PSR stays 1.0 —
the relative-strength signal is still real — but weaker and riskier than the
survivor-only backtest claimed. Even the 32-coin set still excludes truly delisted
coins, so this remains an upper bound. **Real edge, honestly deflated, not
approvable.** Panels: `sample-data/crypto_panel{,_expanded}.csv`.

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
