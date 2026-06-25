# Constraints — Codex

Add rules your loop must never break. The `loop-constraints` skill reads `loop-constraints.md` at the start of every run.

## Quick start

Add to your Automation prompt:

```text
Before any triage or fix: run $loop-constraints. Read loop-constraints.md and enforce every rule.
```

## Adding constraints

Edit `loop-constraints.md` directly:

```
loop-constraints.md rules:
- Don't push before telling me
- Never edit auth/
- Always run tests first
- Max 3 fix attempts per item
```

## Scaffold automatically

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool codex
```
