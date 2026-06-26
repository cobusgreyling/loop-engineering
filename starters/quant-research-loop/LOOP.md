# Loop Configuration — Quant Research (Crypto, Paper)

The five-stage trading loop from the viral "loop engineering for quant" article,
rebuilt the way this repo insists: **report-first, paper-only, with a real
numerical checker** instead of an LLM that opines on backtests.

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
