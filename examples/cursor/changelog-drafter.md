# Changelog Drafter — Cursor (Automations / Agent)

Use Cursor [Automations](https://cursor.com/changelog/03-05-26) to scan recent
merges on a schedule or GitHub event and produce release-note drafts. Week one
stays L1: the Automation may write only `RELEASE_NOTES_DRAFT.md` and
`changelog-drafter-state.md`; a human owns every publish action.

## Setup

Copy the shared scan and drafting skills into Cursor's project-local skill path:

```bash
mkdir -p .cursor/skills/changelog-scan \
  .cursor/skills/draft-release-notes
cp starters/changelog-drafter/.claude/skills/changelog-scan/SKILL.md \
  .cursor/skills/changelog-scan/SKILL.md
cp starters/changelog-drafter/.claude/skills/draft-release-notes/SKILL.md \
  .cursor/skills/draft-release-notes/SKILL.md
cp starters/changelog-drafter/changelog-drafter-state.md.example \
  changelog-drafter-state.md
```

Record the two-file write scope and publish denylist in `.cursor/rules/` as
always-on instructions. These rules are advisory rather than an enforced file
sandbox, so back them with the narrowest available tool and repository scopes.
The Automation does not need release, tag, Discussions, or merge permissions.

## Automation prompt (week one — draft only)

Create a daily Automation, or use a supported GitHub or webhook trigger tied to
the release workflow, with a prompt like:

```text
Read AGENTS.md, changelog-drafter-state.md, and the existing release-note style.
Run the changelog-scan skill for merges to the default branch since the last
release tag or the last completed scan window.

For every included item, cite its PR number or commit SHA. Exclude bot-only
dependency updates and internal chores unless they are security-relevant.
Surface breaking and security changes at the top for human review.

Run draft-release-notes and write RELEASE_NOTES_DRAFT.md.
Update changelog-drafter-state.md with the exact scan window, source count,
draft path, and status "pending human review".

Only those two files may be changed in the Automation's sandbox. Do not edit
CHANGELOG.md.
Do not create or push tags, publish a GitHub Release, post to Discussions,
open or merge a pull request, or send release notifications.
Stop and request human review when sources conflict or attribution is unclear.
```

Review the diff after every run. Cursor Automations are managed outside the
repository, so keep the prompt and `.cursor/rules/` in version control for
review, but treat tool scopes and repository credentials as the enforceable
boundary. Automations can
[open PRs by default](https://cursor.com/changelog/06-18-26). Remove that tool
where the configuration allows; otherwise run without credentials that can push
branches or open or merge PRs, and export the two-file diff as an artifact for a
human to apply.

## Human publish gate

Before anything leaves draft state, a human must:

1. verify every item against its merged PR or commit;
2. confirm the scan window has no gaps or duplicates;
3. review contributor attribution, release voice, upgrade notes, breaking
   changes, and security wording;
4. approve the final destination and exact diff; and
5. separately perform or authorize the tag, release, Discussions post, or merge.

The Automation never publishes directly, even when the draft needs no edits.

## Example `changelog-drafter-state.md`

```markdown
# Changelog Drafter State
Last run: 2026-07-23 06:00 UTC
Last release tag: v2.14.0
Scan window: v2.14.0..abc1234

## Pending draft
- File: RELEASE_NOTES_DRAFT.md
- Sources: 8 merged PRs, 1 direct commit
- Breaking changes: 1 (human wording required)
- Security items: 0
- Status: pending human review

## Publish gate
- Source verification: pending
- Attribution review: pending
- Tag / GitHub Release / Discussions: denied to Automation
```

## References

- [Changelog Drafter starter](../../starters/changelog-drafter/)
- [Week-one story](../../stories/changelog-drafter-week-one.md)
- [Changelog Drafter pattern](../../patterns/changelog-drafter.md)
- [Safety and human gates](../../docs/safety.md)
