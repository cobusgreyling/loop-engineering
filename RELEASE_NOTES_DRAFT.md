# Release notes draft — week of 2026-07-29 (updated 2026-07-30)

**Status:** Draft for human review ([#332](https://github.com/cobusgreyling/loop-engineering/issues/332)). Edit before publishing a discussion post or tagging packages.

**Last published discussion:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Window:** 2026-07-16 → 2026-07-29

---

## Highlights

### Prompt caching cost model (published)

- **`loop-cost` 1.2.0** (published) — `--with-caching` scenario + `stable_fraction` on patterns ([#346](https://github.com/cobusgreyling/loop-engineering/pull/346), [#347](https://github.com/cobusgreyling/loop-engineering/pull/347)). Thanks [@Tusm11](https://github.com/Tusm11).
- **`loop-context` 1.5.0** (published) — `--budget-scenario caching` + frustration circuit breaker.

### Public worktree lock API

- **`loop-worktree` 1.3.1** — public `./lock` subpath export for advisory path locking ([#407](https://github.com/cobusgreyling/loop-engineering/pull/407), thanks [@shixi-li](https://github.com/shixi-li)) plus the concurrent-operation manifest-loss fix ([#430](https://github.com/cobusgreyling/loop-engineering/pull/430)) and the npm≥12 pack-test hardening ([#421](https://github.com/cobusgreyling/loop-engineering/pull/421)–[#423](https://github.com/cobusgreyling/loop-engineering/pull/423)) that landed after the burned tag.
  - Tag: `loop-worktree-v1.3.1` (supersedes `loop-worktree-v1.3.0`; see "Why 1.3.1" below)
  - **Why 1.3.1:** `loop-worktree-v1.3.0` currently points at `1c88a5e` (#422),
    which predates [#423](https://github.com/cobusgreyling/loop-engineering/pull/423)'s
    pack-tarball directory-scan fix — the one that actually survives the release
    workflow's `npm@latest` (12.x). Every 2026-07-29 dispatch of
    `release-loop-worktree.yml` therefore died in the test step
    (`package-exports.test.mjs`, `ERR_INVALID_ARG_TYPE` from an undefined pack
    filename) before reaching publish; reproduced locally: the `1c88a5e` tree
    fails 31/32 under npm 12.0.2, current `main` passes 35/35. npm never received
    1.3.0. Rather than re-pointing the existing tag, bump the version so the
    release rides a fresh tag.

### MiniMax + memory bridge (`loop-init` 1.6.0)

- `--model-provider minimax` for `--with-foundry` implementer stacks, with `--region` / `--model` ([#418](https://github.com/cobusgreyling/loop-engineering/pull/418)). Thanks [@octo-patch](https://github.com/octo-patch).
- `--with-memory` memory-engineering bridge scaffold ([#359](https://github.com/cobusgreyling/loop-engineering/pull/359)).

### Audit self-heal (`loop-audit` 1.8.0)

- `--auto-fix` self-heal for missing repo structure + memory readiness signals ([#358](https://github.com/cobusgreyling/loop-engineering/pull/358), [#359](https://github.com/cobusgreyling/loop-engineering/pull/359)).

### MCP runtime tools (`loop-mcp-server` 1.2.0)

- `loop_audit_score` + `loop_check_breaker` tools ([#360](https://github.com/cobusgreyling/loop-engineering/pull/360)).

### New packages — first publish

| Package | Version | Notes |
|---------|---------|--------|
| `@cobusgreyling/loop-sandbox` | **1.0.0** | Ephemeral worktree isolation + advisory lock ([#370](https://github.com/cobusgreyling/loop-engineering/pull/370), [#399](https://github.com/cobusgreyling/loop-engineering/pull/399)) |
| `@cobusgreyling/loop-swarm` | **1.0.0** | Multi-agent majority consensus over sandboxes ([#398](https://github.com/cobusgreyling/loop-engineering/pull/398)). Thanks [@THRISHAL12345](https://github.com/THRISHAL12345). |

Publish **sandbox before swarm** (swarm depends on `@cobusgreyling/loop-sandbox@^1.0.0`).

### L3 budget negotiator skill

- `budget-negotiator` skill integrated with `loop-budget` + human safety gates ([#400](https://github.com/cobusgreyling/loop-engineering/pull/400)). Thanks [@THRISHAL12345](https://github.com/THRISHAL12345).

### Docs wave (Windsurf + QUICKSTART)

| PR | Contributor | Topic |
|----|-------------|--------|
| [#419](https://github.com/cobusgreyling/loop-engineering/pull/419) | @AIMindCrafter | CI Sweeper production story |
| [#417](https://github.com/cobusgreyling/loop-engineering/pull/417) | @AIMindCrafter | `loop-sandbox` QUICKSTART |
| [#416](https://github.com/cobusgreyling/loop-engineering/pull/416) | @AIMindCrafter | `loop-action` QUICKSTART |
| [#413](https://github.com/cobusgreyling/loop-engineering/pull/413)–[#415](https://github.com/cobusgreyling/loop-engineering/pull/415) | @AIMindCrafter | Windsurf CI / Issue / Dependency sweepers |
| [#409](https://github.com/cobusgreyling/loop-engineering/pull/409) | @k-anushka14 | Merge-gate subsection in QUICKSTART (closes #391) |

### Earlier window (already noted)

- Memory bridge + Cursor examples + CI reliability ([#355](https://github.com/cobusgreyling/loop-engineering/pull/355)–[#362](https://github.com/cobusgreyling/loop-engineering/pull/362))
- Primitives matrix: Continue.dev, Copilot, Cline, Roo Code

---

## Package status (as of 2026-07-30, after the 2026-07-29 publish attempts)

| Package | On npm | Target | State | Action |
|---------|--------|--------|-------|--------|
| `@cobusgreyling/loop-cost` | **1.2.0** | 1.2.0 | Done | — |
| `@cobusgreyling/loop-context` | **1.5.0** | 1.5.0 | Done | — |
| `@cobusgreyling/loop-worktree` | **1.2.0** | **1.3.1** | `v1.3.0` tag burned (its tree predates #423's pack-test fix) | This PR bumps to 1.3.1 → tag `loop-worktree-v1.3.1` |
| `@cobusgreyling/loop-init` | **1.5.0** | **1.6.0** | Tag exists; 07-29 run green through build, failed at publish (E404) | Registry config below, then re-dispatch |
| `@cobusgreyling/loop-audit` | **1.7.0** | **1.8.0** | Tag exists; tests green, publish E404 | Registry config below, then re-dispatch |
| `@cobusgreyling/loop-mcp-server` | **1.1.0** | **1.2.0** | Tag exists; tests green, publish E404 | Registry config below, then re-dispatch |
| `@cobusgreyling/loop-sandbox` | — | **1.0.0** | Tag exists; tests green, publish E404 (first publish) | See first-publish note below |
| `@cobusgreyling/loop-swarm` | — | **1.0.0** | Waiting on sandbox | First publish after sandbox is on npm |
| `@cobusgreyling/loop-gate` | **1.0.0** | 1.0.0 | Done | — |
| `@cobusgreyling/loop` | **0.1.2** | 0.1.2 | Done | — |

### Why every 07-29 publish failed with `npm error 404` (PUT)

All three dispatch rounds ended in `404 Not Found - PUT https://registry.npmjs.org/@cobusgreyling%2f<pkg>`,
including the 15:10 round that ran **after** #422 removed `NODE_AUTH_TOKEN` from the
publish steps. In each log the Sigstore provenance statement is signed and uploaded
*before* the PUT fails, so the GitHub OIDC token itself works — the registry is
rejecting an **unauthenticated** publish (npm reports 404 rather than 403 for
unauthorized package access). That points at the npmjs.com side of trusted
publishing, not the workflows:

- Trusted publishing is configured **per package** on npmjs.com
  (package → Settings → Trusted Publisher), and the **workflow filename must match
  exactly**. This repo uses one workflow per package
  (`release-loop-worktree.yml`, `release-loop-audit.yml`, `release-loop-init.yml`,
  `release-loop-mcp-server.yml`, `release-loop-sandbox.yml`, …), so each package
  needs its own entry pointing at its own filename.
- **First publishes** (`loop-sandbox`, `loop-swarm`): a trusted publisher can only
  be configured on a package that already exists on the registry. If npmjs.com does
  not offer the create-package-with-trusted-publisher flow for the scope, do the
  first publish once from a maintainer machine with a granular token
  (`npm publish --access public`), then add the trusted publisher and let CI own
  subsequent releases.

### Suggested publish sequence (human gate)

1. Merge this PR (bumps `loop-worktree` to 1.3.1; tags for the other packages
   already exist and their tagged trees test green).
2. On npmjs.com, add a Trusted Publisher entry for each package listed above
   (repository `cobusgreyling/loop-engineering`, the package's own
   `release-*.yml` filename, environment blank unless one is configured).
3. Tag the superseding worktree release:
   ```bash
   git tag loop-worktree-v1.3.1 && git push origin loop-worktree-v1.3.1
   ```
   (Leave `loop-worktree-v1.3.0` in place; npm never received 1.3.0 and release
   dispatches must not target it.)
4. Re-dispatch the failed workflows against the existing tags:
   `loop-audit-v1.8.0`, `loop-init-v1.6.0`, `loop-mcp-server-v1.2.0`,
   `loop-sandbox-v1.0.0` (or first-publish sandbox manually per the note above).
   Once sandbox is on npm, create the swarm tag (it does not exist yet):
   ```bash
   git tag loop-swarm-v1.0.0 && git push origin loop-swarm-v1.0.0
   ```
5. Confirm with `npm view @cobusgreyling/<pkg> version`.
6. Fold this draft into a GitHub Discussion; close [#332](https://github.com/cobusgreyling/loop-engineering/issues/332).

---

## Try it (after publish)

```bash
npx @cobusgreyling/loop-worktree --help
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --with-foundry --model-provider minimax
npx @cobusgreyling/loop-audit . --auto-fix
npx @cobusgreyling/loop-sandbox --help
npx @cobusgreyling/loop-swarm run --count 3 -- echo "demo"
```

---

## Housekeeping

- PR triage 2026-07-29: merged docs wave + #398/#400/#407/#418; #409 additive rework; #365 release draft refresh superseded by this file.
- Feature PRs should include `package.json` bumps in the same change (lesson from unpublished features sitting on main at old versions).
