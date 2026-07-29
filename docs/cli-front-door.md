# CLI front door — `@cobusgreyling/loop`

> **Additive.** Old packages stay fully supported. This is the recommended entry for new users, forks, and agents.

## Why

Loop Engineering ships several focused CLIs (`loop-init`, `loop-audit`, `loop-cost`, …). That is great for maintainers; it is hard for first-time adopters to remember.

`@cobusgreyling/loop` is a **thin umbrella**:

1. One binary people can remember  
2. **Pass-through** to existing tools (same flags)  
3. **doctor** / **status** for activation and day-2 habit  

```text
npx @cobusgreyling/loop init . -p daily-triage -t grok
npx @cobusgreyling/loop doctor .
```

## Map (new → same as before)

| Front door | Existing package / command |
|------------|----------------------------|
| `loop init …` | `npx @cobusgreyling/loop-init …` |
| `loop audit …` | `npx @cobusgreyling/loop-audit …` |
| `loop cost …` | `npx @cobusgreyling/loop-cost …` |
| `loop sync …` | `npx @cobusgreyling/loop-sync …` |
| `loop context …` | `npx @cobusgreyling/loop-context …` |
| `loop worktree …` | `npx @cobusgreyling/loop-worktree …` |
| `loop gate …` | `npx @cobusgreyling/loop-gate …` |
| `loop mcp …` | `npx @cobusgreyling/loop-mcp-server …` |
| `loop badge .` | `loop-audit . --badge` |
| `loop doctor .` | **new** (audit + sync + files) |
| `loop status .` | **new** (run-log dashboard) |

`loop init` with `--with-foundry` supports custom provider flags such as `--model-provider minimax --region (global_en|cn_zh) --model MiniMax-M3`. See [QUICKSTART](./QUICKSTART.md#4-audit-readiness-30-seconds) for examples.

## Doctor exit codes

| Code | Meaning | CI use |
|------|---------|--------|
| 0 | Healthy | green |
| 1 | Warnings | soft-fail or comment |
| 2 | Blocked | hard-fail if you require scaffold |

```bash
npx @cobusgreyling/loop doctor . --json
```

## Forks & contributors

- **Forks that already call `loop-init` / `loop-audit`:** change nothing.  
- **New docs / skills / Actions:** prefer `loop`.  
- **Contributors adding tools:** keep a dedicated package; add a one-line pass-through in `tools/loop` if it should be discoverable.

## Agent skill

[`skills/install-loop/SKILL.md`](../skills/install-loop/SKILL.md) — copy into `.grok/skills`, `.claude/skills`, etc., or point agents at this path.

## Publish

```bash
git tag loop-v0.1.0
git push origin loop-v0.1.0
```

Workflow: [`.github/workflows/release-loop.yml`](../.github/workflows/release-loop.yml). See [RELEASE.md](./RELEASE.md).

## Version policy

- `0.x` while the umbrella settles; pass-through tracks whatever sibling versions are installed via monorepo dist or npx.  
- No deprecation of sibling packages in this phase.  
