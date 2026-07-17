# Release notes draft — since Discussion #294

**Status:** Stub for next changelog-drafter run / maintainer publish of `loop-gate`.

**Last published:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Since then on npm:** `loop-worktree` **1.2.0**, `loop-context` **1.3.0** (tags live).

**Window:** 2026-07-16 → (next community announcement)

---

## Highlights

### Shipped on npm

| Package | What shipped |
|---------|--------------|
| `@cobusgreyling/loop-worktree` **1.2.0** | Wait queue (`--wait`) + deadlock detection on path locks ([#295](https://github.com/cobusgreyling/loop-engineering/pull/295) / #292, @THRISHAL12345) |
| `@cobusgreyling/loop-context` **1.3.0** | Similarity-based stagnation detection ([#296](https://github.com/cobusgreyling/loop-engineering/pull/296), @THRISHAL12345) |

### Pending first publish

| Package | PR | What ships |
|---------|-----|------------|
| `@cobusgreyling/loop-gate` **1.0.0** | [#291](https://github.com/cobusgreyling/loop-engineering/pull/291) | Mechanical denylist + auto-merge allowlist from `gate.yaml` (@KhaiTrang1995). Release workflow: `release-loop-gate.yml`. |

### Docs / community

- Architecture diagrams ([#288](https://github.com/cobusgreyling/loop-engineering/pull/288))
- Cross-platform build fix ([#289](https://github.com/cobusgreyling/loop-engineering/pull/289))

---

## Try it

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
# after gate publish:
# npx @cobusgreyling/loop-gate check --action auto-merge --paths README.md
```
