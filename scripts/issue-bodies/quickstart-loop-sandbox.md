## Goal

Add a **loop-sandbox** subsection to QUICKSTART. The package is published and used by `loop-action`, but newcomers may only see audit/init.

## Files

- `docs/QUICKSTART.md` — short subsection after worktree / safety tools
- Cross-link `tools/loop-sandbox/README.md`

## Acceptance criteria

- [ ] Explains ephemeral worktree isolation in one paragraph
- [ ] Shows `npx @cobusgreyling/loop-sandbox run -- <cmd>` (and optional `--shell`)
- [ ] Notes Windows ENOENT auto-retry for npm `.cmd` shims (no need to force `--shell` for npx)
- [ ] Links safety / review of patches before apply

**Estimated time:** ~25 minutes

Comment **"I'll take this"** to get assigned.
