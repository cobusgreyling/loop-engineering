# Release notes draft — since `loop-mcp-server-v1.0.0`

**Status:** Draft for human review ([#181](https://github.com/cobusgreyling/loop-engineering/issues/181)). Edit before publishing a discussion post or tagging packages.

**Window:** 2026-07-06 → 2026-07-22

---

## Highlights

### New: `loop-worktree` CLI ([#190](https://github.com/cobusgreyling/loop-engineering/pull/190))

Isolated git worktrees per fix attempt — supports PR Babysitter and CI Sweeper L2 patterns without branch collisions.

```bash
npx @cobusgreyling/loop-worktree list
npx @cobusgreyling/loop-worktree create fix-123 --branch fix/issue-123
```

Thanks [@KhaiTrang1995](https://github.com/KhaiTrang1995).

### Community docs & stories

| PR | Contributor | What shipped |
|----|-------------|--------------|
| [#182](https://github.com/cobusgreyling/loop-engineering/pull/182) | @k-anushka14 | Multi-loop coordination story |
| [#183](https://github.com/cobusgreyling/loop-engineering/pull/183) | @k-anushka14 | Opencode constraints example |
| [#185](https://github.com/cobusgreyling/loop-engineering/pull/185) | @k-anushka14 | Aider appendix link in examples index |
| Hermes index + QUICKSTART | @AshayK003 ([#187](https://github.com/cobusgreyling/loop-engineering/pull/187)–[#189](https://github.com/cobusgreyling/loop-engineering/pull/189)) | `examples/hermes/README.md`, QUICKSTART section, copy-paste starters row |

### `loop-worktree` npm publish + macOS gc fix ([#204](https://github.com/cobusgreyling/loop-engineering/pull/204))

First npm publish of `@cobusgreyling/loop-worktree` and a fix for the macOS garbage-collection path so worktrees clean up correctly on Darwin.

### Star-history docs page ([#193](https://github.com/cobusgreyling/loop-engineering/pull/193), [#205](https://github.com/cobusgreyling/loop-engineering/pull/205))

New `star-history` docs page with a GitHub token UI for rendering chart SVGs ([#193](https://github.com/cobusgreyling/loop-engineering/pull/193)), later redesigned to match the look-and-feel of star-history.com ([#205](https://github.com/cobusgreyling/loop-engineering/pull/205)).

### Philosophy & contributor growth

- KY cut surface philosophy v0.1 ([#179](https://github.com/cobusgreyling/loop-engineering/pull/179)) — thanks [@sololys](https://github.com/sololys)
- `CONTRIBUTORS.md` automation refresh ([#180](https://github.com/cobusgreyling/loop-engineering/pull/180))

### Housekeeping (this batch)

- **Star-history workflow** — opens an auto-merge PR instead of pushing to protected `main`
- **examples/README.md** — deduplicated Hermes/Aider tool-directory rows
- Stale branch prune + contributor PR backlog triage
- **Star-history chart SVGs** refreshed ([#192](https://github.com/cobusgreyling/loop-engineering/pull/192))
- **Good-first issue count** refreshed to 17 in the README ([#194](https://github.com/cobusgreyling/loop-engineering/pull/194))
- **Daily triage** — automated `STATE.md` + run log update ([#207](https://github.com/cobusgreyling/loop-engineering/pull/207))

---

## npm publish checklist

No version bumps required unless you want to ship `loop-worktree` to npm.

| Package | Current | Action |
|---------|---------|--------|
| `@cobusgreyling/loop-mcp-server` | 1.0.0 | No change |
| `@cobusgreyling/loop-audit` | 1.5.3 | No change |
| `@cobusgreyling/loop-init` | 1.3.3 | No change |
| `loop-worktree` | repo-only | Optional first publish + `loop-worktree-v*` tag |

---

## Suggested publish steps

1. Review and edit this draft.
2. Post summary to [Discussions](https://github.com/cobusgreyling/loop-engineering/discussions/new?category=announcements).
3. Close [#181](https://github.com/cobusgreyling/loop-engineering/issues/181) when published.
4. (Optional) Tag `loop-worktree-v1.0.0` if npm publish is desired — add `release-loop-worktree.yml` first.