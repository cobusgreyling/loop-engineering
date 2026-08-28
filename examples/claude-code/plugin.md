# Claude Code plugin

Install Loop Engineering skills inside Claude Code instead of copying folders by hand.

```bash
# from a Claude Code session, or the CLI:
claude plugin marketplace add cobusgreyling/loop-engineering
claude plugin install loop-engineering
```

This repo is the marketplace (`.claude-plugin/marketplace.json`). Skills live in [`skills/`](../../skills/).

Then scaffold the repo files (STATE, LOOP, budget) if they are missing:

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

First run (report-only):

```
/loop 1d $loop-triage — update STATE.md. Report-only week one.
```

If the plugin directory format changes upstream, the fallback remains: copy `starters/minimal-loop-claude/` as in [daily-triage.md](./daily-triage.md).
