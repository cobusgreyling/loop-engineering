# Claude Code + loop-jev

Jev is the System One layer in front of a Claude Code `/loop`. It does not replace `$skill` files; it decides **whether** to run, **which** model tier, and **what** context to inject.

```bash
npx @cobusgreyling/loop-jev doctor
```

Copy [skills/loop-jev/SKILL.md](../../skills/loop-jev/SKILL.md) into `.claude/skills/loop-jev/` (or rely on this repo’s `skills/` tree). Invoke `$loop-jev` at the start of a turn.

Chain with the mechanical gates:

```bash
npx @cobusgreyling/loop-jev guard --side input --text "$GOAL" || exit 2
npx @cobusgreyling/loop-context --check --ledger loop-ledger.json || exit 2
npx @cobusgreyling/loop-gate check --action commit --paths "$PATHS" || exit 2
```

See [docs/jev.md](../../docs/jev.md).
