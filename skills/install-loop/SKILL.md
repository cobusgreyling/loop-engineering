---
name: install-loop
description: >
  Install Loop Engineering into a project via the unified CLI front door
  (@cobusgreyling/loop). Prefer this over invoking loop-init / loop-audit
  separately. Week-one is report-only; never enable auto-merge or unattended
  fixes unless the human explicitly asks and doctor is healthy.
---

# Install Loop Engineering

## Goal

Leave the repo with a scaffolded **report-only** loop, a **Loop Ready** score, and clear next actions — using the **single** CLI:

```bash
npx @cobusgreyling/loop
```

Do **not** deprecate or remove existing `loop-init` / `loop-audit` usages you find; both doors stay valid. Prefer `loop` for new work.

## Steps

1. **Detect context**
   - If `LOOP.md` or `STATE.md` already exists, run doctor only (skip init unless human asks to re-scaffold):
     ```bash
     npx @cobusgreyling/loop doctor . --json
     npx @cobusgreyling/loop status .
     ```
   - Otherwise continue.

2. **Pick pattern** (default: `daily-triage`)
   | Pain | Pattern |
   |------|---------|
   | Morning chaos / unclear priorities | `daily-triage` |
   | PRs stalling | `pr-babysitter` |
   | CI red / flakes | `ci-sweeper` |
   | CVE / Dependabot noise | `dependency-sweeper` |
   | Post-merge TODOs | `post-merge-cleanup` |
   | Stale release notes | `changelog-drafter` |
   | Noisy issues | `issue-triage` |
   | One GitHub Action, almost no files | `thin-loop` |

3. **Pick tool** — `claude` | `grok` | `codex` | `opencode` (default `claude`).

4. **Scaffold**
   ```bash
   npx @cobusgreyling/loop init . --pattern <pattern> --tool <tool>
   ```
   Optional harness (only if human wants Foundry): add `--with-foundry`.

5. **Doctor**
   ```bash
   npx @cobusgreyling/loop doctor .
   ```
   - Exit `0` = healthy · `1` = warnings · `2` = blocked  
   - Follow the **top 3** printed actions; do not invent extra architecture.

6. **Cost check** before high-cadence schedules:
   ```bash
   npx @cobusgreyling/loop cost -p <pattern> -l L1 -c 1d
   ```

7. **Week-one rule**
   - Report only. No auto-fix, no auto-merge.
   - Tell the human the first `/loop` or scheduler command from init output.
   - Suggest badge only when score is strong: `npx @cobusgreyling/loop badge .`

## Compatibility

These remain fully supported (do not rewrite existing docs/scripts unless asked):

```bash
npx @cobusgreyling/loop-init .
npx @cobusgreyling/loop-audit . --suggest
```

## Stop conditions

- Stop after doctor + first-run instructions unless the human asks for L2+.
- Never expand into fleet/memory/foundry unless score ≥ 80 **and** human opts in.
