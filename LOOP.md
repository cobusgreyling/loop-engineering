# LOOP.md — Loop Engineering Reference

This file documents how the **loop-engineering** reference repository is operated with loop engineering patterns.

The goal of this repo is to be the canonical, copyable, high-signal collection of patterns, starters, and tooling. It eats its own dogfood aggressively.

## Active Loops

### Daily Triage (L1 — automated + report)
- Cadence: 1d weekdays (`/.github/workflows/daily-triage.yml`)
- Skill: `loop-triage` (from `skills/` and `starters/minimal-loop`)
- State: `STATE.md` (updated by workflow; human reviews weekly issue)
- Phase: Report-only. Human reviews and decides actions.
- Handoff: Design decisions, large refactors, new pattern acceptance.

### PR Babysitter (L2 — assisted, manual trigger)
- Cadence: 10–15m during active hours (maintainer `/loop` or future Action)
- Starter: `starters/pr-babysitter` (Grok, Claude Code, Codex)
- Worktrees for suggested fixes; verifier required; no auto-merge by default.

### Dependency Sweeper (L2 — patch-only)
- Cadence: 6h–1d
- Starter: `starters/dependency-sweeper`
- Patch + low-risk CVE only for first 30 days
- Verifier = full `npm ci && npm test` in worktree
- Human gate on majors and denylisted packages

### CI Sweeper / Post-Merge (opportunistic)
- `validate-patterns.yml` + `audit.yml` dogfood pattern validation and readiness scoring
- `audit.yml` posts loop readiness scores on PRs
- Future: sweeper reacting to failing validate/audit runs

### Changelog Drafter (L1 — draft only, high value)
- Cadence: 1d or on release prep (manual or tag-triggered)
- Starter: `starters/changelog-drafter`
- Produces `RELEASE_NOTES_DRAFT.md` (or section for GitHub release). Human approves before publish or CHANGELOG update.
- Excellent low-risk companion to Post-Merge Cleanup. This reference repo should run it for future releases.

## Multi-loop coordination

See [docs/multi-loop.md](docs/multi-loop.md). Priority: CI Sweeper → PR Babysitter → Dependency Sweeper → Post-Merge / Changelog Drafter (off-peak) → Daily Triage (report).

## Worktrees

- Any unattended code-change experiment runs in an **isolated git worktree** per attempt.
- One worktree per fix; discard after verifier REJECT or human escalation.

## Connectors (MCP)

- Optional for L1 daily triage — see [examples/mcp/](examples/mcp/)
- GitHub MCP read-only for issue/PR discovery
- Scope connectors to read + comment until the loop is trusted

## Budget & Observability

- Token caps: `loop-budget.md`
- Run history: `loop-run-log.md` (appended each weekday run by `daily-triage.yml`)
- Estimate: `npx @cobusgreyling/loop-cost --pattern daily-triage`
- Kill switch: `loop-pause-all` label or flag in `STATE.md`

## Safety & Gates (this repo)

- No auto-merge on main except trivial dependency patches (allowlist + verifier)
- Denylist: showcase HTML/CSS, core primitives docs, audit scoring logic without human review
- Live loop state: `STATE.md` at repo root

## How to run locally

```bash
node tools/loop-audit/dist/cli.js . --suggest
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok  # after npm publish
bash scripts/before-after-demo.sh
```

## Evolution

Journey recorded in `stories/`. Target: solid L2 with excellent observability.

---

*This file is both documentation and the seed for the loops that maintain the reference.*