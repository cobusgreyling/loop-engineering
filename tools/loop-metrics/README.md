# loop-metrics

A CLI dashboard for visualizing the token burn, success rate, and ROI of your autonomous loops based on `loop-run-log.md`.

## Installation

This tool runs natively against your loop-engineering repository:

```bash
npm install -g @cobusgreyling/loop-metrics
```

*(Or just run it via `npx` from your project root without installing)*

## Usage

Run the dashboard from the root of a project containing a `loop-run-log.md`:

```bash
npx @cobusgreyling/loop-metrics
```

### Filtering

You can filter the dashboard by a specific loop pattern or restrict the timeframe to a certain number of days (e.g. `7d` for the last 7 days):

```bash
# Only show metrics for the daily-triage pattern over the last 30 days
npx @cobusgreyling/loop-metrics --pattern daily-triage --timeframe 30d
```

### Options

- `--log <path>`: Path to your loop run log (default: `./loop-run-log.md`)
- `--pattern <id>`: Calculate metrics only for a specific pattern.
- `--timeframe <days>`: Limit calculation to runs within the last N days (e.g., `7d`, `30d`).
- `--help`: Show the help message.

## How ROI is Calculated

`loop-metrics` uses a simple heuristic to calculate ROI:
- **+10 points** for every `action_taken` (successful fix, triage, or state update).
- **-5 points** for every `escalation` (tripping a circuit breaker or requiring human intervention).

This gives you an instant, high-level view of whether your autonomous loops are providing net positive value or just generating noise.
