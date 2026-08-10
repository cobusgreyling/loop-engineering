## Goal

Add a **regression test** that skill names are deduplicated across skill directories in `readiness-core`.

**Pain source:** Community PR #475 fixed double-counting when the same skill existed in e.g. `.grok/skills/foo` and `skills/foo`, which inflated the Loop Readiness score.

## Files

- `tools/readiness-core/test/index.test.mjs` (extend)
- Temp fixture dirs created in the test (prefer no permanent multi-dir fixtures unless needed)

## Acceptance criteria

- [ ] Fixture: same skill directory name under two scanned roots → `scanSkillDirectories` returns count **1** for that name
- [ ] Distinct skill names still count separately
- [ ] Documents why dedup matters (score signals `skillsOne` vs `skillsTwoPlus`)
- [ ] `cd tools/readiness-core && npm test` passes

**Estimated time:** ~25–35 minutes · label: tooling

Comment **"I'll take this"** to get assigned.
