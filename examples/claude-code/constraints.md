# Constraints — Claude Code

Add rules your loop must never break. The `loop-constraints` skill reads `loop-constraints.md` at the start of every run.

## Quick start

```bash
# Add a constraint (appends to loop-constraints.md)
/constraints Don't push before telling me. Never edit auth/. Always run tests first.
```

## Before every loop run

```bash
# The loop-constraints skill runs first — it reads loop-constraints.md and bakes
# every rule into the agent's context BEFORE triage or any action skill runs.
/loop 1d Run $loop-constraints, then $loop-triage. Update STATE.md. No auto-fix in week one.
```

## How it works

1. `/constraints <rule>` appends your rule to `loop-constraints.md`
2. The `loop-constraints` skill (from `templates/SKILL.md.loop-constraints`) must be installed in `.claude/skills/loop-constraints/SKILL.md`
3. Every loop run starts with `$loop-constraints` — it reads the file, loads rules, enforces them

## Scaffold automatically

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool claude
```
