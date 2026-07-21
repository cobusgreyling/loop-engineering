# Release playbook — npm packages

This repo ships eleven public npm packages from `tools/`:

| Package | Directory | Release tag |
|---------|-----------|-------------|
| `@cobusgreyling/readiness-core` | `tools/readiness-core` | `readiness-core-v*` |
| `@cobusgreyling/loop-audit` | `tools/loop-audit` | `loop-audit-v*` |
| `@cobusgreyling/loop-init` | `tools/loop-init` | `loop-init-v*` |
| `@cobusgreyling/loop-cost` | `tools/loop-cost` | `loop-cost-v*` |
| `@cobusgreyling/loop-sync` | `tools/loop-sync` | `loop-sync-v*` |
| `@cobusgreyling/loop-context` | `tools/loop-context` | `loop-context-v*` |
| `@cobusgreyling/loop-mcp-server` | `tools/mcp-server` | `loop-mcp-server-v*` |
| `@cobusgreyling/loop-worktree` | `tools/loop-worktree` | `loop-worktree-v*` |
| `@cobusgreyling/loop-gate` | `tools/loop-gate` | `loop-gate-v*` |
| `@cobusgreyling/goal-audit` | `tools/goal-audit` | `goal-audit-v*` |
| `@cobusgreyling/goal-init` | `tools/goal-init` | `goal-init-v*` |

## One-time setup (trusted publishing — recommended)

Link npm to GitHub, then for **each package** on [npmjs.com](https://www.npmjs.com/) → package **Settings** → **Trusted Publisher** → **GitHub Actions**:

| Package | Repository | Workflow filename |
|---------|--------------|-------------------|
| `@cobusgreyling/readiness-core` | `cobusgreyling/loop-engineering` | `release-readiness-core.yml` |
| `@cobusgreyling/loop-audit` | `cobusgreyling/loop-engineering` | `release-loop-audit.yml` |
| `@cobusgreyling/loop-init` | `cobusgreyling/loop-engineering` | `release-loop-init.yml` |
| `@cobusgreyling/loop-cost` | `cobusgreyling/loop-engineering` | `release-loop-cost.yml` |
| `@cobusgreyling/loop-sync` | `cobusgreyling/loop-engineering` | `release-loop-sync.yml` |
| `@cobusgreyling/loop-context` | `cobusgreyling/loop-engineering` | `release-loop-context.yml` |
| `@cobusgreyling/loop-mcp-server` | `cobusgreyling/loop-engineering` | `release-loop-mcp-server.yml` |
| `@cobusgreyling/loop-worktree` | `cobusgreyling/loop-engineering` | `release-loop-worktree.yml` |
| `@cobusgreyling/loop-gate` | `cobusgreyling/loop-engineering` | `release-loop-gate.yml` |
| `@cobusgreyling/goal-audit` | `cobusgreyling/loop-engineering` | `release-goal-audit.yml` |
| `@cobusgreyling/goal-init` | `cobusgreyling/loop-engineering` | `release-goal-init.yml` |

Names must match **exactly** (case-sensitive). No `NPM_TOKEN` secret is required when trusted publishing is configured.

**Auth:** release workflows use repo secret `NPM_TOKEN` (Automation token). Refresh it at [npmjs.com](https://www.npmjs.com/) → Access Tokens if publishes fail with `E401`/`E404`.

**Retry without re-tagging:** Actions → Release workflow → **Run workflow** → enter the tag (e.g. `loop-audit-v1.6.0`).

**Trusted publishing (optional):** configure per package on npm; OIDC alone is not sufficient unless `NPM_TOKEN` is removed and trusted publishers are verified.

## Version bump

Edit `version` in the package `package.json`, update that package's `CHANGELOG.md` if present, and commit to `main` via PR.

## Publish

Tag pushes trigger the release workflows:

```bash
# readiness-core (MUST be published before loop-audit and goal-audit)
git tag readiness-core-v1.0.0
git push origin readiness-core-v1.0.0

# loop-audit (runs tests before publish)
git tag loop-audit-v1.6.0
git push origin loop-audit-v1.6.0

# loop-init (bundles starters/templates, runs smoke tests)
git tag loop-init-v1.3.3
git push origin loop-init-v1.3.3

# loop-cost (bundles patterns/registry.yaml)
git tag loop-cost-v1.0.3
git push origin loop-cost-v1.0.3

# loop-sync (drift detection between STATE.md and LOOP.md)
git tag loop-sync-v1.0.0
git push origin loop-sync-v1.0.0

# loop-context (stateful memory manager + circuit breaker)
git tag loop-context-v1.0.0
git push origin loop-context-v1.0.0

# loop-mcp-server (MCP runtime lookup for patterns, skills, state)
git tag loop-mcp-server-v1.0.0
git push origin loop-mcp-server-v1.0.0

# loop-worktree (isolated git worktrees per fix attempt)
git tag loop-worktree-v1.0.0
git push origin loop-worktree-v1.0.0

# loop-gate (path denylist + auto-merge allowlist)
git tag loop-gate-v1.0.0
git push origin loop-gate-v1.0.0

# goal-audit (Goal Engineering readiness scorer — companion repo)
git tag goal-audit-v1.0.2
git push origin goal-audit-v1.0.2

# goal-init (scaffold goal engineering setups)
git tag goal-init-v1.0.0
git push origin goal-init-v1.0.0
```

Workflows: `.github/workflows/release-readiness-core.yml`, `.github/workflows/release-loop-audit.yml`, `.github/workflows/release-loop-init.yml`, `.github/workflows/release-loop-cost.yml`, `.github/workflows/release-loop-sync.yml`, `.github/workflows/release-loop-context.yml`, `.github/workflows/release-loop-mcp-server.yml`, `.github/workflows/release-loop-worktree.yml`, `.github/workflows/release-loop-gate.yml`, `.github/workflows/release-goal-audit.yml`, `.github/workflows/release-goal-init.yml`.

## Verify after publish

```bash
npx @cobusgreyling/loop-audit --help
npx @cobusgreyling/loop-init --help
npx @cobusgreyling/loop-cost --help
npx @cobusgreyling/loop-sync --help
npx @cobusgreyling/loop-context --help
npx @cobusgreyling/loop-mcp-server --help
npx @cobusgreyling/loop-worktree --help
npx @cobusgreyling/goal-audit --help

mkdir /tmp/loop-init-test && cd /tmp/loop-init-test
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --dry-run
```

## Changelog & release notes (no root `CHANGELOG.md`)

This repo does **not** maintain a root `CHANGELOG.md`. Use:

| Surface | Purpose |
|---------|---------|
| `RELEASE_NOTES_DRAFT.md` | Working draft for the next community update (changelog-drafter + human edit) |
| [GitHub Discussions → Announcements](https://github.com/cobusgreyling/loop-engineering/discussions/categories/announcements) | Published release notes (e.g. [#89](https://github.com/cobusgreyling/loop-engineering/discussions/89), [#219](https://github.com/cobusgreyling/loop-engineering/discussions/219)) |
| `tools/*/CHANGELOG.md` | Per-package history when a tool version bumps |

After publish: trim `RELEASE_NOTES_DRAFT.md` to a short “since last discussion” stub for the next drafter run.

## Before npm is live (local / monorepo)

```bash
cd tools/loop-audit && npm ci && npm test && node dist/cli.js ../.. --suggest
cd tools/loop-init && npm ci && npm test && node dist/cli.js /tmp/target --pattern daily-triage --dry-run
```