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

### Real data

```bash
# Live public Binance klines (no key; may be blocked by your network):
python3 -m engine.loop --once --source live --symbol BTCUSDT --interval 1h

# Or your own CSV (columns: ts,open,high,low,close,volume):
python3 -m engine.loop --once --csv data/btc_1h.csv
```

### Be honest about your search

```bash
# If you grid-searched 200 parameter sets, say so — the bar rises accordingly:
python3 -m engine.loop --once --n-trials 200
```

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
| `engine/verifier.py` | OOS gates: deflated Sharpe, PSR, drawdown, degradation |
| `engine/stats.py` | Overfitting-aware metrics (no numpy/scipy) |
| `skills/alpha-research/SKILL.md` | Maker procedure manual |
| `skills/backtest-verifier/SKILL.md` | Checker procedure manual |
| `quant-state.md.example` | State spine template |
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
