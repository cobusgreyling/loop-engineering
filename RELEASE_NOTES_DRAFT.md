# Release notes draft — since Discussion #294

**Status:** Draft for human review ([#332](https://github.com/cobusgreyling/loop-engineering/issues/332)). Edit before publishing a discussion post or tagging packages.

**Last published:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Window:** 2026-07-16 → 2026-07-22

---

## Highlights

### Prompt caching cost model ([#346](https://github.com/cobusgreyling/loop-engineering/pull/346), [#347](https://github.com/cobusgreyling/loop-engineering/pull/347))

- **`loop-cost` 1.2.0** — `--with-caching` scenario + `stable_fraction` on patterns in `registry.yaml` (cache-read discount on stable report/action tokens).
- **`loop-context` 1.5.0** — `--budget-scenario caching` resolves a cap from the new scenario (shells out with `--with-caching`).

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --with-caching
npx @cobusgreyling/loop-context --check --ledger run.json \
  --budget-from-pattern daily-triage --budget-level L1 --budget-scenario caching
```

Thanks [@Tusm11](https://github.com/Tusm11).

### Circuit breaker + packages already on npm

| Package | Version | Notes |
|---------|---------|--------|
| `@cobusgreyling/loop-context` | **1.4.0** (live) → **1.5.0** (this batch) | Frustration circuit breaker [#337](https://github.com/cobusgreyling/loop-engineering/pull/337); caching scenario this batch |
| `@cobusgreyling/loop-cost` | **1.1.0** (live) → **1.2.0** (this batch) | Prompt-caching estimate this batch |
| `@cobusgreyling/loop-audit` | **1.7.0** | Live |
| `@cobusgreyling/loop-init` | **1.5.0** | Live |
| `@cobusgreyling/loop-worktree` | **1.2.0** | Wait queue + deadlock detection [#292](https://github.com/cobusgreyling/loop-engineering/pull/292); published |
| `@cobusgreyling/loop-gate` | **1.0.0** | First publish from [#291](https://github.com/cobusgreyling/loop-engineering/pull/291); live |
| `@cobusgreyling/goal-init` | **1.0.0** | First publish |
| `@cobusgreyling/readiness-core` | **1.0.0** | First publish (build before loop-audit in CI) |

### Docs appendices (primitives matrix)

| PR | Contributor | Tool |
|----|-------------|------|
| [#351](https://github.com/cobusgreyling/loop-engineering/pull/351) | @shixi-li | Continue.dev (closes #117) |
| [#350](https://github.com/cobusgreyling/loop-engineering/pull/350) | @adity982 | GitHub Copilot (closes #196) |

### Other notable merges (window)

- `loop-worktree` npm path + macOS gc fix [#204](https://github.com/cobusgreyling/loop-engineering/pull/204)
- Star-history docs + chart automation [#193](https://github.com/cobusgreyling/loop-engineering/pull/193), [#205](https://github.com/cobusgreyling/loop-engineering/pull/205), [#192](https://github.com/cobusgreyling/loop-engineering/pull/192)
- Daily triage CI: build readiness-core before loop-audit [#349](https://github.com/cobusgreyling/loop-engineering/pull/349)
- Community docs/stories: multi-loop coordination, Opencode constraints, Hermes examples

---

## Try it

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --with-caching
npx @cobusgreyling/loop-worktree list
```

---

## npm publish checklist (2026-07-22)

| Package | On npm now | This PR / tag | Action |
|---------|------------|---------------|--------|
| `@cobusgreyling/loop-cost` | 1.1.0 | **1.2.0** → `loop-cost-v1.2.0` | **Publish after merge** |
| `@cobusgreyling/loop-context` | 1.4.0 | **1.5.0** → `loop-context-v1.5.0` | **Publish after merge** (depends on cost 1.2.0 for dep range) |
| `@cobusgreyling/loop-audit` | 1.7.0 | — | No change |
| `@cobusgreyling/loop-init` | 1.5.0 | — | No change |
| `@cobusgreyling/loop-worktree` | 1.2.0 | — | Already published |
| `@cobusgreyling/loop-gate` | 1.0.0 | — | Already published |
| `@cobusgreyling/goal-init` | 1.0.0 | — | Already published |
| `@cobusgreyling/readiness-core` | 1.0.0 | — | Already published |
| `@cobusgreyling/loop-mcp-server` | 1.1.0* | — | No change (*confirm if needed) |
| `@cobusgreyling/loop-sync` | 1.0.0* | — | No change |

\* Verify with `npm view @cobusgreyling/<pkg> version` before any announce.

### Suggested publish steps

1. Merge this PR (versions + notes + STATE).
2. Tag and push (triggers release workflows):

```bash
git tag loop-cost-v1.2.0
git push origin loop-cost-v1.2.0
git tag loop-context-v1.5.0
git push origin loop-context-v1.5.0
```

3. Confirm Actions → Release loop-cost / Release loop-context are green.
4. `npm view @cobusgreyling/loop-cost version` → `1.2.0`; same for `loop-context` → `1.5.0`.
5. Human: fold this draft into discussion/announce for [#332](https://github.com/cobusgreyling/loop-engineering/issues/332) when ready.
6. Supersedes contributor draft [#348](https://github.com/cobusgreyling/loop-engineering/pull/348) (stale checklist).

---

## Housekeeping

- PR triage 2026-07-22: merged #351/#350; closed #344 superseded; held then superseded #348.
- Feature PRs must include `package.json` bumps + this checklist row in the same change (lesson from #346/#347 gap).
