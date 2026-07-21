# Post-Merge Cleanup Starter

Scaffold for the [Post-Merge Cleanup](../../patterns/post-merge-cleanup.md) loop (L1 report → L2 small fixes).

## Quick Start

```bash
# Grok
npx @cobusgreyling/loop-init . --pattern post-merge-cleanup --tool grok

# Or manual copy
cp -r starters/post-merge-cleanup/.grok/skills/post-merge-scan .grok/skills/
cp starters/post-merge-cleanup/post-merge-state.md.example post-merge-state.md
cp starters/post-merge-cleanup/LOOP.md .
```

Start (Grok):

```
/loop 1d Run post-merge-scan on merges to main (last 7d). Update post-merge-state.md. Small doc/link fixes only in worktree. Run loop-context --check before each retry on the same regression; run loop-gate check before commit. Escalate refactors.
```

## Files

| File | Purpose |
|------|---------|
| `post-merge-state.md.example` | Cleanup backlog from recent merges |
| `.grok/skills/post-merge-scan/` | Scan skill |
| `LOOP.md` | Cadence and gates |

## Safety

- No large refactors without human ticket
- Denylist: feature flags, auth paths — see [safety.md](../../docs/safety.md)