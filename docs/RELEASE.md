# Release playbook — npm packages

This repo ships five public npm packages from `tools/`:

| Package | Directory | Release tag |
|---------|-----------|-------------|
| `@cobusgreyling/loop-audit` | `tools/loop-audit` | `loop-audit-v*` |
| `@cobusgreyling/loop-init` | `tools/loop-init` | `loop-init-v*` |
| `@cobusgreyling/loop-cost` | `tools/loop-cost` | `loop-cost-v*` |
| `@cobusgreyling/loop-sync` | `tools/loop-sync` | `loop-sync-v*` |
| `@cobusgreyling/loop-context` | `tools/loop-context` | `loop-context-v*` |

## One-time setup (trusted publishing — recommended)

Link npm to GitHub, then for **each package** on [npmjs.com](https://www.npmjs.com/) → package **Settings** → **Trusted Publisher** → **GitHub Actions**:

| Package | Repository | Workflow filename |
|---------|--------------|-------------------|
| `@cobusgreyling/loop-audit` | `cobusgreyling/loop-engineering` | `release-loop-audit.yml` |
| `@cobusgreyling/loop-init` | `cobusgreyling/loop-engineering` | `release-loop-init.yml` |
| `@cobusgreyling/loop-cost` | `cobusgreyling/loop-engineering` | `release-loop-cost.yml` |
| `@cobusgreyling/loop-sync` | `cobusgreyling/loop-engineering` | `release-loop-sync.yml` |
| `@cobusgreyling/loop-context` | `cobusgreyling/loop-engineering` | `release-loop-context.yml` |

Names must match **exactly** (case-sensitive). No `NPM_TOKEN` secret is required when trusted publishing is configured.

**Auth:** release workflows use repo secret `NPM_TOKEN` (Automation token). Refresh it at [npmjs.com](https://www.npmjs.com/) → Access Tokens if publishes fail with `E401`/`E404`.

**Retry without re-tagging:** Actions → Release workflow → **Run workflow** → enter the tag (e.g. `loop-audit-v1.4.2`).

**Trusted publishing (optional):** configure per package on npm; OIDC alone is not sufficient unless `NPM_TOKEN` is removed and trusted publishers are verified.

## Version bump

Edit `version` in the package `package.json`, update that package's `CHANGELOG.md` if present, and commit to `main` via PR.

## Publish

Tag pushes trigger the release workflows:

```bash
# loop-audit (runs tests before publish)
git tag loop-audit-v1.3.0
git push origin loop-audit-v1.3.0

# loop-init (bundles starters/templates, runs smoke tests)
git tag loop-init-v1.2.0
git push origin loop-init-v1.2.0

# loop-cost (bundles patterns/registry.yaml)
git tag loop-cost-v1.0.0
git push origin loop-cost-v1.0.0

# loop-sync (drift detection between STATE.md and LOOP.md)
git tag loop-sync-v1.0.0
git push origin loop-sync-v1.0.0

# loop-context (stateful memory manager + circuit breaker)
git tag loop-context-v1.0.0
git push origin loop-context-v1.0.0
```

Workflows: `.github/workflows/release-loop-audit.yml`, `.github/workflows/release-loop-init.yml`, `.github/workflows/release-loop-cost.yml`, `.github/workflows/release-loop-sync.yml`, `.github/workflows/release-loop-context.yml`.

## Verify after publish

```bash
npx @cobusgreyling/loop-audit --help
npx @cobusgreyling/loop-init --help
npx @cobusgreyling/loop-cost --help
npx @cobusgreyling/loop-sync --help
npx @cobusgreyling/loop-context --help

mkdir /tmp/loop-init-test && cd /tmp/loop-init-test
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --dry-run
```

## Before npm is live (local / monorepo)

```bash
cd tools/loop-audit && npm ci && npm test && node dist/cli.js ../.. --suggest
cd tools/loop-init && npm ci && npm test && node dist/cli.js /tmp/target --pattern daily-triage --dry-run
```