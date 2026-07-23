# Release notes draft — week of 2026-07-20 (updated 2026-07-23)

**Status:** Draft for human review ([#332](https://github.com/cobusgreyling/loop-engineering/issues/332)). Edit before publishing a discussion post or tagging packages.

**Last published discussion:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Window:** 2026-07-16 → 2026-07-23

---

## Highlights

### Prompt caching cost model ([#346](https://github.com/cobusgreyling/loop-engineering/pull/346), [#347](https://github.com/cobusgreyling/loop-engineering/pull/347))

- **`loop-cost` 1.2.0** (published) — `--with-caching` scenario + `stable_fraction` on patterns in `registry.yaml`.
- **`loop-context` 1.5.0** (published) — `--budget-scenario caching` resolves a cap from the new scenario.

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --with-caching
npx @cobusgreyling/loop-context --check --ledger run.json \
  --budget-from-pattern daily-triage --budget-level L1 --budget-scenario caching
```

Thanks [@Tusm11](https://github.com/Tusm11).

### Memory bridge + loop-audit auto-fix (merged, **needs version bumps**)

Landed on `main` 2026-07-23 but **package versions were not bumped** — still report as 1.7.0 / 1.5.0 / 1.1.0 on npm until publish PR + tags.

| Change | PR | Suggested next version |
|--------|-----|------------------------|
| `loop-audit --auto-fix` self-heal | [#358](https://github.com/cobusgreyling/loop-engineering/pull/358) | `loop-audit` **1.8.0** |
| Memory-engineering bridge (`--with-memory`, Memory Ready signals) | [#359](https://github.com/cobusgreyling/loop-engineering/pull/359) | `loop-init` **1.6.0** + `loop-audit` **1.8.0** |
| MCP: `loop_audit_score` + `loop_check_breaker` tools | [#360](https://github.com/cobusgreyling/loop-engineering/pull/360) | `loop-mcp-server` **1.2.0** |

Thanks [@THRISHAL12345](https://github.com/THRISHAL12345).

### CI reliability

- Isolate audit/validation gate temp files for concurrent worktrees [#362](https://github.com/cobusgreyling/loop-engineering/pull/362) (thanks [@shixi-li](https://github.com/shixi-li))
- Build `readiness-core` before loop-audit in daily-triage [#349](https://github.com/cobusgreyling/loop-engineering/pull/349)

### Docs — primitives matrix + Cursor examples

| PR | Contributor | Topic |
|----|-------------|--------|
| [#355](https://github.com/cobusgreyling/loop-engineering/pull/355) | @shixi-li | Cline appendix (GFI #147) |
| [#356](https://github.com/cobusgreyling/loop-engineering/pull/356) | @shixi-li | Cursor CI Sweeper example (GFI #220) |
| [#357](https://github.com/cobusgreyling/loop-engineering/pull/357) | @shixi-li | Cursor Changelog Drafter example (GFI #223) |
| [#351](https://github.com/cobusgreyling/loop-engineering/pull/351) | @shixi-li | Continue.dev appendix (GFI #117) |
| [#350](https://github.com/cobusgreyling/loop-engineering/pull/350) | @adity982 | GitHub Copilot appendix (GFI #196) |

---

## Package status (as of 2026-07-23)

| Package | On npm | On main (unreleased work?) | Action |
|---------|--------|----------------------------|--------|
| `@cobusgreyling/loop-cost` | **1.2.0** | 1.2.0 | Done |
| `@cobusgreyling/loop-context` | **1.5.0** | 1.5.0 | Done |
| `@cobusgreyling/loop-audit` | **1.7.0** | features from #358/#359 without version bump | Bump → **1.8.0**, changelog, tag |
| `@cobusgreyling/loop-init` | **1.5.0** | `--with-memory` from #359 without version bump | Bump → **1.6.0**, tag |
| `@cobusgreyling/loop-mcp-server` | **1.1.0** | MCP tools from #360 without version bump | Bump → **1.2.0**, tag |
| `@cobusgreyling/loop-worktree` | **1.2.0** | — | No change |
| `@cobusgreyling/loop-gate` | **1.0.0** | — | No change |
| `@cobusgreyling/goal-init` | **1.0.0** | — | No change |
| `@cobusgreyling/readiness-core` | **1.0.0** | — | No change |
| `@cobusgreyling/loop-sync` | **1.0.0** | — | Verify if needed |

### Suggested publish sequence (after version PR)

1. Human: open version-bump PR for `loop-audit` 1.8.0, `loop-init` 1.6.0, `loop-mcp-server` 1.2.0 (+ CHANGELOG rows).
2. Merge version PR.
3. Tag in order (audit before consumers if needed):  
   `loop-audit-v1.8.0` → `loop-init-v1.6.0` → `loop-mcp-server-v1.2.0`
4. Confirm with `npm view @cobusgreyling/<pkg> version`.
5. Human: fold this draft into a GitHub Discussion / announce; then close [#332](https://github.com/cobusgreyling/loop-engineering/issues/332).

---

## Try it (published today)

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1 --with-caching
npx @cobusgreyling/loop-worktree list
```

After the 1.8 / 1.6 / 1.2.0 publishes:

```bash
npx @cobusgreyling/loop-audit . --auto-fix   # when 1.8.0 is live
npx @cobusgreyling/loop-init . --pattern daily-triage --with-memory
```

---

## Housekeeping (this prep window)

- Docs batch + tooling merged 2026-07-23: #355–#363 (see PR list above).
- Zero open PRs after housekeeping; remaining GFIs include #224 (Cursor Issue Triage — draft PR), #195, stories.
- Feature PRs that land on `tools/*` should include `package.json` version bumps in the **same** change (lesson from #346/#347 and repeated for #358–#360).
