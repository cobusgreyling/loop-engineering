# AGENTS.md — loop-engineering reference

Conventions for humans and loops maintaining this repository.

## Build & verify

```bash
# Unified front door (prefer for new workflows)
cd tools/loop && npm ci && npm test
node dist/cli.js doctor ../..
node dist/cli.js status ../..

# Loop readiness audit CLI (still canonical scorer)
cd tools/loop-audit && npm ci && npm run build
node dist/cli.js ../..              # audit repo root
node dist/cli.js ../.. --suggest    # show copy commands for gaps

# Jev decision layer (route / retrieve / guard / classify)
cd tools/loop-jev && npm ci && npm test
node dist/cli.js doctor

# Before/after demo (scores an empty dir → starter → L2)
bash scripts/before-after-demo.sh
```

Front door map: [docs/cli-front-door.md](docs/cli-front-door.md). Agent install skill: [skills/install-loop/SKILL.md](skills/install-loop/SKILL.md).

CI runs `validate-patterns` and `audit` on every push/PR (see `.github/workflows/`).

## Review norms

- Patterns and starters must stay **tool-agnostic in intent**; tool-specific paths live under `examples/` and per-tool starters.
- Never auto-merge changes to `docs/primitives*.md`, `tools/loop-audit/src/`, or showcase assets without human review.
- Failure stories in `stories/` should include token cost, root cause, and remediation — not just wins.
- New patterns require an entry in `patterns/registry.yaml`.

## Loop operation (this repo)

- **Daily triage**: `loop-triage` skill → `STATE.md` (report-only, L1).
- **Fixes**: only via PR with human review; `minimal-fix` + `loop-verifier` for assisted changes (L2).
- **Isolation**: use git worktrees for any unattended code-change experiments (see `LOOP.md`).

## Test commands

This repo has no application test suite. Quality gates:

```bash
cd tools/loop && npm test && node dist/cli.js doctor ../..
cd tools/loop-audit && npm run build && node dist/cli.js ../../
bash scripts/before-after-demo.sh
```