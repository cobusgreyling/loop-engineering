# What do you want to do?

This repo is a **pattern library for operating agents around a codebase** — triage, babysit PRs, sweep CI, keep deps current. It is not a “finish my feature / rewrite the module” button.

| I want to… | Start here | Do **not** start here |
|------------|------------|------------------------|
| Keep a repo healthy (issues, CI, deps, changelog) | [Quickstart](./QUICKSTART.md) → `daily-triage` | Unattended L3 on day one |
| Run a loop as one GitHub Action with almost no files | [Thin loop](../starters/thin-loop/) | Expecting a high Loop Ready score |
| Land and babysit pull requests | [PR Babysitter](../patterns/pr-babysitter.md) | Merging from the loop |
| Fix a red build | [CI Sweeper](../patterns/ci-sweeper.md) | Patching flakes forever |
| Upgrade dependencies safely | [Dependency Sweeper](../patterns/dependency-sweeper.md) | Major bumps without a human |
| **Ship a feature or refactor** (break work into todos, run them) | **[Refactor / change path](./refactor.md)** | A single “refactor the repo” loop |
| Run until a scoped objective is done | [Goal Engineering](https://github.com/cobusgreyling/goal-engineering) (`/goal`) | Pretending `daily-triage` is a task runner |
| Persist memory across sessions | [Memory Engineering](https://github.com/cobusgreyling/memory-engineering) | Stuffing everything into `STATE.md` |
| Govern many agents | [Fleet Engineering](https://github.com/cobusgreyling/fleet-engineering) | One `LOOP.md` for a whole org |

**Week-one rule still applies:** report only. Read what the loop writes before you let it act.

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

`--tool` defaults to `claude`. Swap for `grok`, `codex`, or `opencode`. Unsure which pattern? [Pattern picker](https://cobusgreyling.github.io/loop-engineering/#interactive).
