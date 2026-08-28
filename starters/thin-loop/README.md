# Thin Loop starter

One GitHub Action. No `STATE.md`, no skills, no budget files.

The issue tracker is the spine. The job summary is the report. Week one is L1 (report only).

## Install

```bash
npx @cobusgreyling/loop init . --pattern thin-loop --tool claude
```

Or copy:

```bash
mkdir -p .github/workflows
cp starters/thin-loop/.github/workflows/thin-loop.yml .github/workflows/
```

Merge to `main`. Open an issue or wait for the weekday cron. Read the Actions summary.

## What you get

| File | Purpose |
|------|---------|
| `.github/workflows/thin-loop.yml` | Event + weekday snapshot |
| `LOOP.md` | Cadence and gates in one page |

## What you do not get (on purpose)

- `STATE.md` — add it when findings must persist across runs ([Daily Triage](../minimal-loop-claude/)).
- Agent invocation — wire [loop-action](../../tools/loop-action/) later if you want a model in the loop.
- A high Loop Ready score — files-on-disk are not the goal here.

## First week

1. Merge the workflow.
2. Confirm one run is green.
3. Read the summary. Do not let it label, close, or push.
4. Graduate to Daily Triage only if you need a queue that GitHub does not already hold.
