## Goal

Expand **CONTRIBUTING.md** with Path A / B / C so first-time contributors do not hit monorepo setup walls.

**Pain source:** Community PR #477 documented root `npm ci` after fresh clones failed with `ERR_MODULE_NOT_FOUND: yaml` when only `tools/*/npm ci` was run. Still missing a clear “which path do I need?” map.

## Files

- `CONTRIBUTING.md` — add **Contributor paths** section near Development Setup
- Optional one-line pointer from README Help wanted → CONTRIBUTING paths

## Acceptance criteria

- [ ] **Path A — Content only:** markdown under `stories/`, `examples/`, `docs/adopters.md` — no install
- [ ] **Path B — One package:** `cd tools/<pkg> && npm ci && npm test` for a single CLI fix
- [ ] **Path C — Full monorepo:** root `npm ci` + `validate:registry` + `check:loop-init`
- [ ] Mentions same-day review for stories/adopters
- [ ] Links live GFI filter

**Estimated time:** ~20–25 minutes · label: docs

Comment **"I'll take this"** to get assigned.
