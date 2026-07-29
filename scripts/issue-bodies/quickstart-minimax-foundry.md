## Goal

Document **MiniMax** `--with-foundry` flags in QUICKSTART (or the Foundry CTA section) so implementer stacks can pick MiniMax without reading only `loop-init` help text.

## Context

`loop-init` 1.6.0 supports:

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok \
  --with-foundry --model-provider minimax --region global_en --model MiniMax-M3
```

## Files

- `docs/QUICKSTART.md` — short note near Foundry / `--with-foundry` CTA
- Optional one-line cross-link from `docs/cli-front-door.md` if present

## Acceptance criteria

- [ ] Documents `--model-provider minimax`, `--region` (`global_en` | `cn_zh`), and `--model` options
- [ ] One copy-paste example that works with the unified front door *or* `loop-init`
- [ ] Points to MiniMax / foundry docs if linked from the repo
- [ ] Additive only — no front-door regressions

**Estimated time:** ~20–25 minutes

Comment **"I'll take this"** to get assigned.
