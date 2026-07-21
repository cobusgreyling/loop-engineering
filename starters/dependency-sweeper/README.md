# Dependency Sweeper Starter

Clone-and-run scaffold for the **Dependency Sweeper** pattern (L2 assisted, patch-only with strong verifier gates).

## Quick Start

```bash
npx @cobusgreyling/loop-init . --pattern dependency-sweeper --tool grok
```

Or manual copy:

```bash
cp -r starters/dependency-sweeper/.grok/skills/dependency-triage .grok/skills/
mkdir -p .grok/skills/loop-verifier .grok/skills/minimal-fix
cp templates/SKILL.md.verifier .grok/skills/loop-verifier/SKILL.md
cp templates/SKILL.md.minimal-fix .grok/skills/minimal-fix/SKILL.md
cp starters/dependency-sweeper/dependency-sweeper-state.md.example dependency-sweeper-state.md
cp starters/dependency-sweeper/LOOP.md .
```

Claude Code / Codex: use `--tool claude` or `--tool codex` with `loop-init`.

Start (Grok):

```
/loop 6h Run dependency-triage on package manifests and lockfiles. Patch-only auto-fix in worktree + verifier (npm ci && npm test). Run loop-context --check before each retry on the same package; run loop-gate check before commit. Escalate majors, high-sev CVEs, and denylist packages after 2 attempts. Update dependency-sweeper-state.md.
```

## What's Included

| File | Purpose |
|------|---------|
| `dependency-sweeper-state.md.example` | State spine (in-flight updates, denylist) |
| `.grok/.claude/.codex/skills/dependency-triage/` | Triage skill (all tools) |
| `.claude/agents/loop-verifier.md` | Checker agent |
| `.codex/agents/verifier.toml` | Checker subagent |
| `LOOP.md` | Cadence, gates, budget |

## Next Steps

- [patterns/dependency-sweeper.md](../../patterns/dependency-sweeper.md)
- [docs/loop-design-checklist.md](../../docs/loop-design-checklist.md)
- [stories/dependency-sweeper-week-one.md](../../stories/dependency-sweeper-week-one.md)

**Safety**: Majors and high-severity breaking fixes stay behind explicit human gates.