# LOOP.md — Thin loop

- **Pattern:** thin-loop
- **Level:** L1 report-only
- **Cadence:** `issues`/`pull_request` opened + weekdays 08:00 UTC
- **State:** none. GitHub issues and PRs are the backlog. The Actions job summary is the report.
- **Writes:** job summary; at most one comment per thread (`<!-- thin-loop -->`).
- **Denylist:** no code edits, no labels, no closes, no pushes.
- **Kill switch:** disable `.github/workflows/thin-loop.yml` or cancel the workflow.

When a queue must survive across runs (attempt counts, budgets, watch lists), graduate to Daily Triage and add `STATE.md`.
