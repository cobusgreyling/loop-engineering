# Constraints — Cursor

Binding rules your loop must never break. The `loop-constraints` skill reads `loop-constraints.md` at the start of every run.

Cursor has no native `/constraints` or `/loop` command — you enforce rules with a skill, always-on rules, and an Automation (or manual Agent) prompt that runs constraints **before** triage.

## Quick start

Create the constraint file and skill:

```bash
mkdir -p .cursor/skills/loop-constraints
cp templates/SKILL.md.loop-constraints .cursor/skills/loop-constraints/SKILL.md
cp templates/loop-constraints.md loop-constraints.md
```

Edit `loop-constraints.md` and add your rules:

```markdown
# Loop Constraints

- Don't push before telling me.
- Never edit auth/ or payments/.
- Always run tests before proposing a fix.
```

Optional: mirror critical rules in `.cursor/rules/loop-constraints.mdc` so they apply even outside Automations (see [safety.md](../../docs/safety.md) for path denylist examples).

## Before every loop run

In Cursor → Automations (or Agent chat on cadence), run constraints **first**, then triage:

```text
Run the loop-constraints skill. Read loop-constraints.md and enforce every rule.
Then run loop-triage. Update STATE.md (High Priority + Watch List only).
No auto-fix in week one. Escalate anything touching the denylist in docs/safety.md.
```

## How it works

1. `loop-constraints.md` lives at the repo root — one rule per line below the header.
2. `loop-constraints` skill lives at `.cursor/skills/loop-constraints/SKILL.md` (copy from `templates/SKILL.md.loop-constraints`).
3. Every loop run starts with the constraints skill — it reads the file and bakes rules into context before triage or any action skill runs.
4. Optional always-on rules in `.cursor/rules/` reinforce denylist paths and human gates from [safety.md](../../docs/safety.md).

## Manual copy (no loop-init yet)

There is no `loop-init --tool cursor` yet. Copy from any starter:

```bash
cp starters/minimal-loop/STATE.md.example STATE.md
mkdir -p .cursor/skills/loop-triage .cursor/skills/loop-constraints
cp templates/SKILL.md.loop-triage .cursor/skills/loop-triage/SKILL.md
cp templates/SKILL.md.loop-constraints .cursor/skills/loop-constraints/SKILL.md
cp templates/loop-constraints.md loop-constraints.md
```

Audit after copying:

```bash
npx @cobusgreyling/loop-audit . --suggest
```

## Safety

Constraints are *binding*. If a rule can be misinterpreted, rewrite it — the loop will not second-guess, the human will. Encode path denylist and auto-merge policy from [safety.md](../../docs/safety.md) in both `loop-constraints.md` and `.cursor/rules/`.

## References

- [templates/loop-constraints.md](../../templates/loop-constraints.md) — default constraint set
- [templates/SKILL.md.loop-constraints](../../templates/SKILL.md.loop-constraints) — constraints skill template
- [docs/safety.md](../../docs/safety.md) — denylist, human gates, auto-merge policy
- [daily-triage.md](./daily-triage.md) — week-one triage Automation prompt