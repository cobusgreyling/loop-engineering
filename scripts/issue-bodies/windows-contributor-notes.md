## Goal

Add a short **Windows / CRLF notes** subsection so Windows users do not re-discover line-ending bugs.

**Pain source:** PR #476 (loop-sync frontmatter CRLF) and earlier loop-sandbox Windows `spawn ENOENT` notes. Scattered fixes; no single “Windows contributors” landing spot.

## Files

- `docs/QUICKSTART.md` — short subsection (or link from Development / Operating)
- Optionally cross-link from `CONTRIBUTING.md`

## Acceptance criteria

- [ ] Notes git `core.autocrlf` recommendation for this repo
- [ ] Points at loop-sync frontmatter LF/CRLF support (after #476)
- [ ] Points at loop-sandbox Windows `npx` / `.cmd` shim behaviour if already documented
- [ ] 1 short “if you hit X, try Y” troubleshooting bullet list
- [ ] No wall of text — ~15–25 lines max

**Estimated time:** ~20–25 minutes · label: docs

Comment **"I'll take this"** to get assigned.
