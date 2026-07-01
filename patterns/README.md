# Loop Patterns

Documented, reusable loop patterns that have been (or can be) run in real environments.

Each pattern answers:
- What problem it solves
- Recommended scheduling
- Required skills / state shape
- Verification approach
- Human hand-off strategy
- Tool-specific notes (Grok, Claude Code, Codex, OpenClaw, Opencode, GitHub Actions)

## Pattern Registry

| Pattern | Cadence | Risk | File |
|---------|---------|------|------|
| PR Babysitter | 5–15m | Medium | [pr-babysitter.md](./pr-babysitter.md) |
| Daily Triage | 1d–2h | Low | [daily-triage.md](./daily-triage.md) |
| Issue Triage (new) | 2h–1d | Low | [issue-triage.md](./issue-triage.md) |
| CI Sweeper | 5–15m | Medium | [ci-sweeper.md](./ci-sweeper.md) |
| Post-Merge Cleanup | 1d–6h | Low | [post-merge-cleanup.md](./post-merge-cleanup.md) |
| Dependency Sweeper | 6h–1d | Medium | [dependency-sweeper.md](./dependency-sweeper.md) |
| Changelog Drafter | 1d | Low | [changelog-drafter.md](./changelog-drafter.md) |

Machine-readable index: [registry.yaml](./registry.yaml)

## How to Use a Pattern

1. Pick a pattern: [pattern-picker.md](../docs/pattern-picker.md)
2. Scaffold with `npx @cobusgreyling/loop-init . --pattern <name> --tool grok` (or `--tool opencode` / `--tool claude`) or copy from `starters/`
3. Copy skills from `templates/` if customizing beyond the starter
4. Set up scheduling (`/loop`, `scheduler_create`, GitHub Action, Codex Automation)
5. Run week one in **L1 report-only** mode before enabling fixes
6. Audit with `npx @cobusgreyling/loop-audit . --suggest`

## Adding a Pattern

Use [templates/pattern-template.md](../templates/pattern-template.md), add an entry to `registry.yaml`, and open a PR. See [CONTRIBUTING.md](../CONTRIBUTING.md).