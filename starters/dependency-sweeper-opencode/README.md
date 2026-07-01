# Dependency Sweeper — Opencode Starter

Clone-and-run scaffold for the **Dependency Sweeper** pattern with opencode. Discover, safely apply, and verify dependency updates.

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern dependency-sweeper --tool opencode
```

Or copy manually:

```bash
cp -r starters/dependency-sweeper-opencode/skills .
cp starters/dependency-sweeper-opencode/AGENTS.md .
cp starters/dependency-sweeper-opencode/LOOP.md .
cp starters/dependency-sweeper-opencode/dependency-sweeper-state.md.example dependency-sweeper-state.md
cp starters/dependency-sweeper-opencode/opencode.json.example opencode.json
```

Start (L2 assisted, patch-only):

```bash
opencode run \
  "Run skills/dependency-triage/SKILL.md. Scan package manifests for outdated and vulnerable deps. Patch-only auto-fix in worktree with verifier. Escalate majors, high-sev CVEs, and denylist packages. Update state." \
  --title "Dependency sweeper"
```

## What's Included

| File | Purpose |
|------|---------|
| `dependency-sweeper-state.md.example` | State spine (in-flight updates, denylist) |
| `skills/dependency-triage/SKILL.md` | Dependency-focused triage skill |
| `AGENTS.md` | Always-on safety rules |
| `LOOP.md` | Cadence, gates, budget |
| `opencode.json.example` | Named agent definitions |

## Next Steps

- [patterns/dependency-sweeper.md](../../patterns/dependency-sweeper.md)
- [examples/opencode/dependency-sweeper.md](../../examples/opencode/dependency-sweeper.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- [stories/dependency-sweeper-week-one.md](../../stories/dependency-sweeper-week-one.md)
