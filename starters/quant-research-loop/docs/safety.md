# Safety — Quant Research Loop

- **Paper only.** No live order execution is wired anywhere. The forward tracker marks
  strategies to market on paper; there is no exchange trading path and no API keys.
- **Kill switches.** Drawdown breaker (`engine/risk.py`); a forward mandate breach flags the
  thesis on the scoreboard; research trial-budget auto-halt (`engine/ledger.py`) stops the
  search before it overfits the data.
- **No re-optimization / no goalpost-moving.** Frozen strategies are write-once
  (`forward-registration.json`). Changing a thesis means a NEW name with a NEW start date —
  never editing an existing one after seeing results.
- **Data & egress.** Read-only public price feeds only (Coinbase public candles, Coin Metrics
  community CSV). No secrets, no write access to any venue.
- **MCP / connectors.** Not required for this loop. If added later, scope any connector to
  read-only until trusted.
- **Going live is out of scope** and would require, separately: an order connector behind an
  allowlist, position + notional caps, a live kill-switch process, and a human approving the
  switch. Treat that as a different project.
