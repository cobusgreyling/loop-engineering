# Release notes draft — since `loop-context-v1.1.0`

**Status:** Ready for human review (release prep [#272](https://github.com/cobusgreyling/loop-engineering/issues/272), 2026-07-15).

**Window:** 2026-07-13 → 2026-07-15 (tag `loop-context-v1.1.0` through maintainer batch)

---

## Highlights

### Published Jul 13 — npm batch

| Package | Version | Tag | What shipped |
|---------|---------|-----|--------------|
| `@cobusgreyling/loop-cost` | **1.1.0** | `loop-cost-v1.1.0` | Multi-agent orchestration cost on the action path ([#256](https://github.com/cobusgreyling/loop-engineering/pull/256), @KhaiTrang1995) |
| `@cobusgreyling/loop-context` | **1.1.0** | `loop-context-v1.1.0` | `--budget-from-pattern` resolves per-run token caps from `loop-cost` ([#258](https://github.com/cobusgreyling/loop-engineering/pull/258), @KhaiTrang1995) |
| `@cobusgreyling/loop-init` | **1.4.0** | `loop-init-v1.4.0` | Dependency sync + maintenance publish ([#271](https://github.com/cobusgreyling/loop-engineering/pull/271)) |

```bash
npx @cobusgreyling/loop-context --check --ledger run.json \
  --budget-from-pattern ci-sweeper --budget-level L2
npx @cobusgreyling/loop-cost --pattern ci-sweeper --level L2 --json
```

### Next npm publish (merged 2026-07-15)

| Package | PR | What ships |
|---------|-----|------------|
| `@cobusgreyling/loop-context` **1.2.0** | [#273](https://github.com/cobusgreyling/loop-engineering/pull/273) | Daily token spend tracking (`--daily-budget-from-pattern`), `--on-exceed` hook for `loop-budget.md` automation (@KhaiTrang1995) |
| `@cobusgreyling/loop-worktree` **1.1.0** | [#274](https://github.com/cobusgreyling/loop-engineering/pull/274) | Advisory path locking (`lock` / `unlock` / `locks`) for multi-loop collision prevention (@KhaiTrang1995) |

```bash
# Daily cap across separate runs
npx @cobusgreyling/loop-context --check --ledger run.json \
  --daily-budget-from-pattern ci-sweeper --on-exceed ./scripts/on-budget-exceed.sh

# Multi-loop path coordination
npx @cobusgreyling/loop-worktree lock --paths 'package-lock.json,pnpm-lock.yaml' --owner ci-sweeper
npx @cobusgreyling/loop-worktree locks --json
```

### Infra

- **Star-history CI** — `update-star-history.yml` now requires `STAR_HISTORY_TOKEN` (fine-grained PAT). `GITHUB_TOKEN` cannot list stargazers under GitHub's Jul 2026 API restriction. SVGs refreshed to ~7,928 stars.

---

## Docs & examples (since prior draft)

| PR | Contributor | What shipped |
|----|-------------|--------------|
| [#268](https://github.com/cobusgreyling/loop-engineering/pull/268) | @Mahizhan-S | Cursor post-merge cleanup example |
| [#251](https://github.com/cobusgreyling/loop-engineering/pull/251) | @Mahizhan-S | Cursor dependency sweeper example |
| [#247](https://github.com/cobusgreyling/loop-engineering/pull/247) | @AshayK003 | Hermes PR Babysitter example |
| [#257](https://github.com/cobusgreyling/loop-engineering/pull/257) | @k-anushka14 | dependency-vs-ci-sweeper collision story |
| [#249](https://github.com/cobusgreyling/loop-engineering/pull/249) | @Mahizhan-S | Codeium (Windsurf) primitives appendix |
| [#263](https://github.com/cobusgreyling/loop-engineering/pull/263) | maintainer | `loop-sync` QUICKSTART subsection |

---

## npm packages (current on main)

| Package | Version | Notes |
|---------|---------|-------|
| `@cobusgreyling/loop-context` | 1.1.0 → **1.2.0** pending tag | Daily budget + on-exceed hook after #273 publish |
| `@cobusgreyling/loop-worktree` | 1.0.0 → **1.1.0** pending tag | Path locking after #274 publish |
| `@cobusgreyling/loop-cost` | **1.1.0** | Multi-agent orchestration estimates |
| `@cobusgreyling/loop-init` | **1.4.0** | |
| `@cobusgreyling/loop-audit` | **1.6.0** | No change this window |
| `@cobusgreyling/loop-mcp-server` | 1.0.0 | No change |
| `@cobusgreyling/loop-sync` | 1.0.0 | No change |
| `@cobusgreyling/goal-audit` | 1.0.2 | Companion stack |

---

## Suggested publish sequence

After review, tag and push in dependency order:

```bash
git tag loop-context-v1.2.0 && git push origin loop-context-v1.2.0
git tag loop-worktree-v1.1.0 && git push origin loop-worktree-v1.1.0
```

Then publish a GitHub Discussion (see prior drafts [#219](https://github.com/cobusgreyling/loop-engineering/discussions/219), [#241](https://github.com/cobusgreyling/loop-engineering/discussions/241)) and close [#272](https://github.com/cobusgreyling/loop-engineering/issues/272).

---

## Try it in 5 minutes

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-context --check --ledger run.json --budget-from-pattern daily-triage
```

Week two (L2): pair `loop-worktree` path locks with `loop-context --daily-budget-from-pattern` — see [QUICKSTART](docs/QUICKSTART.md).