# Release playbook — npm packages

This repo ships two public npm packages from `tools/`:

| Package | Directory | Release tag |
|---------|-----------|-------------|
| `@cobusgreyling/loop-audit` | `tools/loop-audit` | `loop-audit-v*` |
| `@cobusgreyling/loop-init` | `tools/loop-init` | `loop-init-v*` |
| `@cobusgreyling/loop-cost` | `tools/loop-cost` | `loop-cost-v*` |

## One-time setup (trusted publishing — recommended)

Link npm to GitHub, then for **each package** on [npmjs.com](https://www.npmjs.com/) → package **Settings** → **Trusted Publisher** → **GitHub Actions**:

| Package | Repository | Workflow filename |
|---------|--------------|-------------------|
| `@cobusgreyling/loop-audit` | `cobusgreyling/loop-engineering` | `release-loop-audit.yml` |
| `@cobusgreyling/loop-init` | `cobusgreyling/loop-engineering` | `release-loop-init.yml` |
| `@cobusgreyling/loop-cost` | `cobusgreyling/loop-engineering` | `release-loop-cost.yml` |

Names must match **exactly** (case-sensitive). No `NPM_TOKEN` secret is required when trusted publishing is configured.

**Legacy fallback:** add an npm Automation token as repo secret `NPM_TOKEN` and restore `NODE_AUTH_TOKEN` in the publish steps.

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
```

Workflows: `.github/workflows/release-loop-audit.yml`, `.github/workflows/release-loop-init.yml`, `.github/workflows/release-loop-cost.yml`.

## Verify after publish

```bash
npx @cobusgreyling/loop-audit --help
npx @cobusgreyling/loop-init --help
npx @cobusgreyling/loop-cost --help

mkdir /tmp/loop-init-test && cd /tmp/loop-init-test
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --dry-run
```

## Before npm is live (local / monorepo)

```bash
cd tools/loop-audit && npm ci && npm test && node dist/cli.js ../.. --suggest
cd tools/loop-init && npm ci && npm test && node dist/cli.js /tmp/target --pattern daily-triage --dry-run
```