# Release notes draft — since `loop-context-v1.2.0`

**Status:** Stub for next changelog-drafter run.

**Last published:** [Discussion #294](https://github.com/cobusgreyling/loop-engineering/discussions/294) (2026-07-16) — `loop-context` 1.2.0, `loop-worktree` 1.1.0.

**Window:** 2026-07-16 → (next tag)

---

## Highlights

_(changelog-drafter will fill from merges since `loop-context-v1.2.0`)_

### Pending npm publish

| Package | PR | What ships |
|---------|-----|------------|
| `@cobusgreyling/loop-worktree` **1.2.0** | [#292](https://github.com/cobusgreyling/loop-engineering/pull/292) | Wait queue (`--wait`) + deadlock detection on path locks (@THRISHAL12345) |
| `@cobusgreyling/loop-gate` **1.0.0** | [#291](https://github.com/cobusgreyling/loop-engineering/pull/291) | Mechanical denylist + auto-merge allowlist from `gate.yaml` (@KhaiTrang1995) |

---

## Try it

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-audit . --suggest
```