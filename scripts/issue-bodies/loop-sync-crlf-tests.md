## Goal

Add **regression tests** for CRLF frontmatter parsing in `loop-sync`.

**Pain source:** Community PR #476 fixed Windows line endings (`\r\n`) in `extractFrontmatter`. Without tests, a future change can re-break Windows contributors.

## Files

- `tools/loop-sync/test/sync.test.mjs` (extend)
- Optional fixture files under `tools/loop-sync/test/fixtures/` if cleaner

## Acceptance criteria

- [ ] Test: LF frontmatter still parses (existing behaviour)
- [ ] Test: CRLF frontmatter (`---\r\nkey: value\r\n---\r\nbody`) parses keys without trailing `\r`
- [ ] Test: `---hello` (no newline after opening fence) is **rejected** / not treated as frontmatter
- [ ] `cd tools/loop-sync && npm test` passes

**Estimated time:** ~30–40 minutes · label: tooling

Comment **"I'll take this"** to get assigned.
