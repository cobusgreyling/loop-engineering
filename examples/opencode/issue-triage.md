# Issue Triage — Opencode

Keep the issue queue legible so morning triage and humans always know the top five. Low-risk companion to [Daily Triage](./daily-triage.md). Opencode lets you run this on a faster cadence (2h–1d) headless via cron.

## Prerequisites

```bash
mkdir -p skills/issue-triage
cp templates/SKILL.md.issue-triage skills/issue-triage/SKILL.md
cp starters/minimal-loop-opencode/opencode.json.example opencode.json
cp starters/issue-triage-opencode/issue-triage-state.md.example issue-triage-state.md
```

Optionally enable GitHub MCP read-only for richer issue discovery:

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

## L1 — Propose Only (Week 1)

```bash
opencode run \
  "Run skills/issue-triage/SKILL.md. Read issue-triage-state.md first. Scan open issues and discussions since last run. Update state with:
- Top 5 prioritized items (P0-P3) with one-sentence summaries
- Suggested labels (proposed only — do not apply)
- Needs human bucket for ambiguous or security-sensitive items
Do not auto-label, close, or comment on issues. Escalate duplicates as 'possible duplicate of #NNN' for human confirmation." \
  --title "Issue triage"
```

Cron (faster cadence for busy repos):

```cron
0 */2 * * * cd /repo && opencode run "Run issue-triage. Report top 5 open issues. Propose labels. Do not edit issues."
```

## L2 — Auto-Label Allowlisted Labels (Week 3+)

After 10 stable L1 runs, enable auto-apply for safe label categories:

```bash
opencode run \
  "Run issue-triage. For allowlisted labels (area:*, needs-repro, needs-info, duplicate?) apply them after verifier passes. Never auto-apply P0, P1, security, or breaking-change labels. Never close or comment without human approval." \
  --agent implementer
```

## State Shape

```markdown
# Issue Triage State
Last run: 2026-06-20 09:00 UTC
Open actionable: 14 (was 17)
New since last run: 3
Needs human: 2

## Top 5 (by loop score)
- #487 (bug, p1, 2d old) — "Crash on export with large files" — suggested: bug, needs-repro, area:export
- #491 (feature, p2) — "Dark mode for settings" — suggested: enhancement, area:ui

## Proposed Labels (not applied — L1)
- #487: bug, needs-repro, area:export
- #491: enhancement, area:ui
```

## Verification Split

| Role | Opencode shape |
|------|----------------|
| Triage | `skills/issue-triage/SKILL.md` |
| Verifier (L2) | `opencode run "Verify labels are allowlisted" --agent verifier --file <issue-list>` |

## Pairing with Daily Triage

Issue Triage runs more frequently (2h–1d) and produces a clean queue. Daily Triage (1d) reads `issue-triage-state.md` and merges the top items into `STATE.md` High Priority.

```bash
opencode run "Run loop-triage. Read STATE.md and issue-triage-state.md. Merge top issue-triage items into High Priority. Report only."
```

## Safety

- L1: propose only — never auto-label, auto-close, or auto-comment.
- P0/P1 on auth, payments, security, or public API: always escalate to a human.
- L2 auto-labels limited to a curated allowlist; verifier gate required.

## References

- [patterns/issue-triage.md](../../patterns/issue-triage.md)
- [docs/primitives-matrix.md](../../docs/primitives-matrix.md)
- [examples/github-actions/issue-triage.yml](../github-actions/issue-triage.yml)
- [stories/daily-triage-report-only.md](../../stories/daily-triage-report-only.md)
