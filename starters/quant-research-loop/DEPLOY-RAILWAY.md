# Deploy the forward tracker on Railway

An always-on service that checks prices on a schedule, marks the frozen strategies
to market, and persists a live P&L record + scoreboard. Pure stdlib, no database
required (though you can add one later).

## What it is

- `engine/service.py` — a web service (status page on `$PORT`) with a background
  scheduler that runs `forward_paper.run(refresh=True)` every `CHECK_INTERVAL_SECONDS`.
- Persists to `QUANT_DATA_DIR` (mount a Railway **Volume** there so the record
  survives redeploys): `forward-registration.json`, `quant-forward-state.md`,
  `quant-forward-log.md`, `scoreboard.json`.
- Config lives in `railway.json` + `Dockerfile`.

## One-time setup

1. **New Railway project → Deploy from repo**, root set to `starters/quant-research-loop`
   (or point the service's root directory there). Railway reads `railway.json` and
   builds the `Dockerfile`.
2. **Add a Volume**, mount path `/data`. The Dockerfile already sets
   `QUANT_DATA_DIR=/data`.
3. **Generate a domain** (Settings → Networking) to see the status page. Railway
   injects `$PORT` automatically; the service binds it.
4. (Optional) Override `CHECK_INTERVAL_SECONDS` (default `86400` = daily).

That's it. The service boots, auto-registers the frozen strategies (write-once),
and starts checking. Visit the domain for the scoreboard; `GET /scoreboard.json`
for the machine-readable version; `GET /health` for the healthcheck.

## The data caveat (read this)

The default price source is the free Coin Metrics community dataset, which can lag
by days–weeks. Forward rows only appear once it publishes bars **after** the
registration date. For same-day tracking, wire a real-time feed (Binance.US /
Coinbase) into `data.py` / `multi_data.py` — Railway has open internet, so exchange
APIs that are blocked in some sandboxes work there.

## Adding a new thesis (the iterate loop)

1. Add an entry to `FROZEN_STRATEGIES` in `engine/forward_paper.py` (single-asset
   or a multi-asset `xsectional` config).
2. Redeploy. The service **auto-registers** it (write-once) stamped at the latest
   data date, and starts tracking it alongside the others.
3. Watch the scoreboard. Each thesis shows: forward days, equity, Sharpe, drawdown,
   and `within_mandate` / `breached` / `awaiting_data`.

Registration is write-once per name — you never move a thesis's goalposts. To
revise a thesis, register a NEW name (a new hypothesis with a new start date).

## Run it locally first

```bash
QUANT_DATA_DIR=./data CHECK_INTERVAL_SECONDS=3600 PORT=8080 python -m engine.service
# → open http://localhost:8080
```
