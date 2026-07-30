## Goal

Document the **public** `@cobusgreyling/loop-worktree/lock` import path in QUICKSTART (L2 worktree section), so loops can use advisory path locks from JS without deep-importing `dist/`.

## Context

`loop-worktree` 1.3.1 exports:

```js
import { lockPaths, unlockPaths, LOCKS_DIR } from '@cobusgreyling/loop-worktree/lock';
```

CLI still has `lock` / `unlock` / `locks`.

## Files

- `docs/QUICKSTART.md` — under L2 / `loop-worktree`
- Cross-link `tools/loop-worktree/README.md`

## Acceptance criteria

- [ ] Shows both CLI lock example and public JS import
- [ ] Notes multi-loop collision use case in one sentence
- [ ] Additive only

**Estimated time:** ~20 minutes

Comment **"I'll take this"** to get assigned.
