# Issue Triage — OpenClaw

Keep the issue queue legible so morning triage and humans always know the top five. Low-risk companion to Daily Triage. OpenClaw's frequent cron cadence (2h–1d) keeps the queue fresh.

## Prerequisites

```bash
mkdir -p skills/issue-triage
cp templates/SKILL.md.issue-triage skills/issue-triage/SKILL.md
cp starters/minimal-loop/STATE.md.example issue-triage-state.md
```

## L1 — Propose Only (Week 1)

```bash
openclaw cron create "0 */2 * * *" \
  --name "Issue triage" \
  --session isolated \
  --message "Run skills/issue-triage/SKILL.md. Read issue-triage-state.md first. Scan open issues since last run. Update state with top 5 prioritized items, proposed labels, and needs-human bucket. Propose only — do not apply labels, close, or comment on issues. Escalate duplicates as possible duplicate of #NNN for human confirmation." \
  --tools read
```

## L2 — Auto-Label Allowlisted Labels (Week 3+)

```bash
openclaw cron edit <job-id> \
  --message "Run issue-triage. For allowlisted labels (area:*, needs-repro, needs-info, duplicate?) apply them after verifier passes. Never auto-apply P0, P1, security, or breaking-change labels. Never close or comment without human approval."
```

## Pairing with Daily Triage

Issue Triage runs more frequently (2h–1d) and produces a clean queue. Daily Triage (1d) reads `issue-triage-state.md` and merges the top items into `STATE.md` High Priority.

## Safety

- L1: propose only — never auto-label, auto-close, or auto-comment.
- P0/P1 on auth, payments, security, or public API: always escalate to a human.
- L2 auto-labels limited to curated allowlist; verifier gate required.

## References

- [patterns/issue-triage.md](../../patterns/issue-triage.md)
- [docs/primitives-matrix.md](../../docs/primitives-matrix.md)
- [examples/github-actions/issue-triage.yml](../github-actions/issue-triage.yml)
