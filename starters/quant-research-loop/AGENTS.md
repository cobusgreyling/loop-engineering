# AGENTS.md — Quant Research Loop

Conventions for agents (and humans) working in this starter.

## Build & test

- Pure Python **stdlib** — no third-party dependencies, no install step.
- Run the suite: `python3 test_engine.py` (also works under `pytest`).
- Run the app / loop: `python3 -m engine.loop --help`, `python3 -m engine.forward_paper --run`,
  `python3 -m engine.service` (always-on tracker).

## Layout

- `engine/` — data adapters (`data`, `coinbase`, `multi_data`), strategies (`strategy`,
  `xsectional`), verifier + walk-forward + lockbox + quarantine, blotter, forward tracker,
  and the Railway `service`.
- `sample-data/` — committed price snapshots (offline seed / fallback).
- `forward-registration.json` — the FROZEN, write-once strategy contract.

## Review norms

- **Never re-optimize a frozen strategy.** A new thesis = a new name with a new start date.
- **Verification is mandatory** before any "approved" claim: out-of-sample, walk-forward,
  survivorship-corrected. No survivor-only backtests.
- **Everything reconciles.** Blotter per-trade PnL reconciles to backtest equity to 1e-9;
  per-coin contribution reconciles to portfolio returns. Keep it that way.
- **Degrees-of-freedom discipline.** Small param grids; honor the enforced trial counter and
  `--trial-budget` auto-halt. Hand-sweeping params is uncounted multiple testing.
- **Paper only.** No live order path. Going live is a separate, human-gated project.
