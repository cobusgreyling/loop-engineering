# Release notes draft — week of 2026-07-29 (updated 2026-07-29)

**Status:** Draft for human review ([#332](https://github.com/cobusgreyling/loop-engineering/issues/332)). Edit before publishing a discussion post or tagging packages.

**Last published discussion:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Window:** 2026-07-16 → 2026-07-29

---

## Highlights

### Prompt caching cost model (published)

- **`loop-cost` 1.2.0** (published) — `--with-caching` scenario + `stable_fraction` on patterns ([#346](https://github.com/cobusgreyling/loop-engineering/pull/346), [#347](https://github.com/cobusgreyling/loop-engineering/pull/347)). Thanks [@Tusm11](https://github.com/Tusm11).
- **`loop-context` 1.5.0** (published) — `--budget-scenario caching` + frustration circuit breaker.

### Public worktree lock API

- **`loop-worktree` 1.3.0** — public `./lock` subpath export for advisory path locking ([#407](https://github.com/cobusgreyling/loop-engineering/pull/407)). Thanks [@shixi-li](https://github.com/shixi-li).
  - Tag: `loop-worktree-v1.3.0` (ready once this PR is on main)

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

## Package status (as of 2026-07-29)

| Package | On npm (before this batch) | Target | Action |
|---------|----------------------------|--------|--------|
| `@cobusgreyling/loop-cost` | **1.2.0** | 1.2.0 | Done |
| `@cobusgreyling/loop-context` | **1.5.0** | 1.5.0 | Done |
| `@cobusgreyling/loop-worktree` | **1.2.0** | **1.3.0** | Tag `loop-worktree-v1.3.0` (version already on main) |
| `@cobusgreyling/loop-init` | **1.5.0** | **1.6.0** | Version bump in this PR → tag `loop-init-v1.6.0` |
| `@cobusgreyling/loop-audit` | **1.7.0** | **1.8.0** | Version bump in this PR → tag `loop-audit-v1.8.0` |
| `@cobusgreyling/loop-mcp-server` | **1.1.0** | **1.2.0** | Version bump in this PR → tag `loop-mcp-server-v1.2.0` |
| `@cobusgreyling/loop-sandbox` | — | **1.0.0** | First publish → tag `loop-sandbox-v1.0.0` |
| `@cobusgreyling/loop-swarm` | — | **1.0.0** | First publish after sandbox → tag `loop-swarm-v1.0.0` |
| `@cobusgreyling/loop-gate` | **1.0.0** | 1.0.0 | No change |
| `@cobusgreyling/loop` | **0.1.2** | 0.1.2 | No change |

### Suggested publish sequence (human gate — tags only)

1. Merge this version / release-workflow PR.
2. Tag in order:
   ```bash
   git tag loop-worktree-v1.3.0 && git push origin loop-worktree-v1.3.0
   git tag loop-audit-v1.8.0 && git push origin loop-audit-v1.8.0
   git tag loop-init-v1.6.0 && git push origin loop-init-v1.6.0
   git tag loop-mcp-server-v1.2.0 && git push origin loop-mcp-server-v1.2.0
   git tag loop-sandbox-v1.0.0 && git push origin loop-sandbox-v1.0.0
   # after sandbox is on npm:
   git tag loop-swarm-v1.0.0 && git push origin loop-swarm-v1.0.0
   ```
3. Confirm with `npm view @cobusgreyling/<pkg> version`.
4. Fold this draft into a GitHub Discussion; close [#332](https://github.com/cobusgreyling/loop-engineering/issues/332).

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
