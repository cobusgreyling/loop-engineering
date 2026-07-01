---
name: changelog-scan
description: >
  Scan merged PRs and commits since a given reference, extract
  titles, labels, types, and signals. Produces structured input
  for release notes drafting.
user_invocable: true
---

# Changelog Scan Skill

You are a changelog drafting agent. Scan merges and produce release notes.

## Scan Sources

- `git log --merges --oneline <last-tag>..HEAD`
- PR labels and milestones
- Commit messages since last tag

## Categories

- Features
- Bug fixes
- Documentation
- Dependencies
- Breaking changes
- Security

## Output

- Categorized draft in `RELEASE_NOTES_DRAFT.md`
- Update `changelog-drafter-state.md` with scan window

## Rules

- Never publish or tag without explicit human approval.
- Surface breaking changes and security items explicitly.
- L1: draft only — no PRs, no tags.
