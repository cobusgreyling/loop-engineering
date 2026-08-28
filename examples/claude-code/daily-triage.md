# Daily Triage — Claude Code

Same pattern as Grok; different scheduling primitives.

Install skills via the [Claude Code plugin](./plugin.md), or copy folders below.

## Report-Only (Week 1)

```bash
/loop 1d Run $loop-triage. Read STATE.md. Merge findings into High Priority and Watch List. Update Last run. Do not edit code.
```

## With Small Auto-Fixes (Week 3+)

```bash
/loop 1d Run $loop-triage. For high-priority items that are single-file bugfixes: spawn implementer in worktree, then verifier agent. Update STATE.md. Escalate ambiguous items.
```

## Skills Setup

Copy from `templates/SKILL.md.loop-triage` to `.claude/skills/loop-triage/SKILL.md` (or project skills path per your Claude Code version).

## Sub-agents

Create `.claude/agents/loop-verifier.md` from `templates/SKILL.md.verifier` frontmatter + body.

Use `isolation: worktree` when spawning implementer tasks.

## Goal Mode Alternative

For a one-shot "get main green" session:

```bash
/goal All tests on main pass and lint is clean
```

`/goal` uses a fresh model to check the stop condition — maker/checker at the goal layer.

## References

- Boris Cherny: `/loop 30m /slack-feedback`, daily triage automations
- [primitives-matrix.md](../../docs/primitives-matrix.md)