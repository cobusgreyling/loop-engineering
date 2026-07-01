# Changelog Drafter — OpenClaw

Scan merged PRs and commits, produce categorized release notes. Excellent low-risk L1 loop — pairs naturally with Post-Merge Cleanup.

## Prerequisites

```bash
mkdir -p skills/changelog-scan skills/draft-release-notes
cp templates/SKILL.md.loop-triage skills/changelog-scan/SKILL.md
cp templates/SKILL.md.loop-triage skills/draft-release-notes/SKILL.md
cp starters/minimal-loop/STATE.md.example changelog-drafter-state.md
```

## L1 — Report + Draft (Week 1)

```bash
openclaw cron create "0 3 * * *" \
  --name "Changelog drafter" \
  --session isolated \
  --message "Run skills/changelog-scan/SKILL.md. Scan merges since the last tag (or last 7 days). Produce a clean categorized draft in RELEASE_NOTES_DRAFT.md using skills/draft-release-notes/SKILL.md. Update changelog-drafter-state.md. Do not publish, tag, or create PRs." \
  --tools read,write
```

## L2 — PR Proposal (Week 3+)

```bash
openclaw cron edit <job-id> \
  --message "Run changelog-scan and draft-release-notes. If the draft looks good, create a new branch and commit RELEASE_NOTES_DRAFT.md. Open a draft PR. Flag breaking changes and security items explicitly in the PR body. Do not merge."
```

## What the Loop Maintains

- `changelog-drafter-state.md` — last scanned window, draft status, human feedback
- `RELEASE_NOTES_DRAFT.md` — overwritten or versioned each run

## Safety

- Draft-only in week one. No tags, no PRs, no publishes without human approval.
- Breaking changes and security items must be surfaced explicitly.

## References

- [patterns/changelog-drafter.md](../../patterns/changelog-drafter.md)
- [stories/changelog-drafter-week-one.md](../../stories/changelog-drafter-week-one.md)
