# loop-init

Scaffold loop engineering starters into your project by pattern and tool.

**npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok** works immediately.

See [docs/loop-init-validation.md](../../docs/loop-init-validation.md) for a validated pattern × --tool matrix.

## Install & Run

```bash
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
npx @cobusgreyling/loop-init . --pattern daily-triage --tool opencode
npx @cobusgreyling/loop-init . -p pr-babysitter -t claude
npx @cobusgreyling/loop-init . -p dependency-sweeper --dry-run
# One-command LE → harness-foundry funnel:
npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok --with-foundry
```

See [docs/RELEASE.md](../../docs/RELEASE.md) for npm publish tags. The published package bundles `starters/` and `templates/` from this monorepo.

After scaffolding, always run `npx @cobusgreyling/loop-audit . --suggest` and actually execute the first report-only loop to generate activity signals.

## `--with-foundry` (harness runtime)

Scaffolds a [harness-foundry](https://github.com/cobusgreyling/harness-foundry) stack beside your loop files:

| LE pattern | Foundry preset |
|------------|----------------|
| `daily-triage`, `issue-triage`, `changelog-drafter` | `minimal` |
| `pr-babysitter`, `ci-sweeper`, `dependency-sweeper`, `post-merge-cleanup` | `implementer` |

Creates `.foundry/stack.yaml`, outerloop hook stub, and a short README. Equivalent alias on the Foundry CLI:

```bash
npx @cobusgreyling/harness-foundry init --from loop-engineering:daily-triage
```

Every `loop-init` run prints a Foundry CTA; when Loop Ready is **≥ 80**, the CTA is emphasized as the next step after design.

### Interface provider (implementer preset)

The `implementer` preset defaults to the built-in interface primitive. Pass `--model-provider minimax` to emit a `model/minimax` provider primitive instead. The generated stack always carries both regional endpoints and both model options, so you can switch region/model without regenerating:

```bash
npx @cobusgreyling/loop-init . -p ci-sweeper -t grok --with-foundry --model-provider minimax
npx @cobusgreyling/loop-init . -p ci-sweeper -t grok --with-foundry --model-provider minimax --region cn_zh --model MiniMax-M2.7
```

| Flag | Values | Default |
|------|--------|---------|
| `--model-provider` | `anthropic`, `minimax` | `anthropic` |
| `--region` | `global_en`, `cn_zh` | `global_en` |
| `--model` | `MiniMax-M3`, `MiniMax-M2.7` | `MiniMax-M3` |

MiniMax model options and both endpoints (`global_en` → `https://api.minimax.io`, `cn_zh` → `https://api.minimaxi.com`) are written into `.foundry/stack.yaml`.

## Patterns

| Pattern | Default state file |
|---------|-------------------|
| `daily-triage` | `STATE.md` |
| `pr-babysitter` | `pr-babysitter-state.md` |
| `ci-sweeper` | `ci-sweeper-state.md` |
| `dependency-sweeper` | `dependency-sweeper-state.md` |
| `post-merge-cleanup` | `post-merge-state.md` |
| `changelog-drafter` | `changelog-drafter-state.md` |
| `issue-triage` | `issue-triage-state.md` |

L2 patterns (`ci-sweeper`, `dependency-sweeper`) also copy `minimal-fix` and `loop-verifier` templates when missing from the starter.

Fix-capable patterns (`pr-babysitter`, `ci-sweeper`, `dependency-sweeper`, `post-merge-cleanup`) also get a **circuit breaker**:

- `loop-guard` skill — logs each attempt to `loop-ledger.json` and runs [`loop-context`](../loop-context) `--check` before retrying
- `loop-ledger.json` — seeded with the pattern's goal, its `pattern`/`level`, and an empty `attempts` array

The ledger's `pattern`/`level` let `loop-guard` size the breaker's `--token-budget` from [`loop-cost`](../loop-cost)'s realistic per-run estimate instead of a hand-typed number. The breaker escalates (same error N× in a row, too many consecutive failures, token budget, or iteration cap) instead of looping in vain. Report-only patterns skip it.

Patterns that act on human-authored, often underspecified input (`issue-triage`) also get an **intake** skill:

- `loop-intake` skill — when a work item is too vague to verify "done", it asks one question at a time, pushes for exact values, and writes an open question + `needs-human` escalation instead of guessing. Clarifying up front keeps the loop from burning fix attempts on a goal that was never well defined.

Every scaffold also creates:

- `loop-budget.md` — pattern-specific daily caps and kill switch
- `loop-run-log.md` — append-only run history
- `loop-budget` skill — runtime budget guard at start/end of each run

## Tools

- `grok` (default)
- `claude`
- `codex`
- `opencode` — daily-triage ships `minimal-loop-opencode` (`skills/`, `AGENTS.md`, `opencode.json`)

Falls back to Grok starter paths when a per-tool variant is not yet available.

## From this repo

```bash
cd tools/loop-init && npm ci && npm test
node dist/cli.js /path/to/project --pattern daily-triage --tool grok
```

Pair with `loop-audit` and `loop-cost` after scaffolding:

```bash
npx @cobusgreyling/loop-cost --pattern daily-triage --level L1
npx @cobusgreyling/loop-audit . --suggest
```