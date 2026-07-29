# GitHub Actions Examples

Includes triggers for the new **Changelog Drafter** pattern (daily or on tags). See `changelog-drafter.yml`.

Event-driven and scheduled loops **without** a TUI session. The refactored workflow examples in this directory use the [`loop-action`](../../tools/loop-action/README.md) composite action to automatically run readiness audits (`loop-audit`), check circuit breakers (`loop-context`), and isolate execution in worktrees (`loop-sandbox`).

## Composite Action (`loop-action`)

Instead of writing manual shell scripts for audits and circuit breakers in your workflows, use the [`tools/loop-action`](../../tools/loop-action/README.md) composite action:

```yaml
- uses: cobusgreyling/loop-engineering/tools/loop-action@main
  with:
    pattern: 'daily-triage'
    level: 'L1'
    sandbox: 'false'
    command: |
      npx grok-cli run --skill .grok/skills/loop-triage/SKILL.md
```

## Wiring Your Agent

Replace the `command:` input or placeholder steps with your choice of agent harness:

| Approach | When |
|----------|------|
| `loop-action` (recommended) | Automated audit + circuit breaker + worktree sandbox in CI |
| Codex CLI / API | Headless Codex in CI |
| `repository_dispatch` | External runner with Grok/Claude |
| Custom script | Rule-based triage only (L0) |

The state file schema and skills are tool-agnostic — only the invocation step differs.

## Workflows

| File | Trigger | Pattern |
|------|---------|---------|
| [daily-triage.yml](./daily-triage.yml) | Cron weekdays | Daily Triage |
| [ci-sweeper.yml](./ci-sweeper.yml) | `workflow_run` failure | CI Sweeper |
| [post-merge-cleanup.yml](./post-merge-cleanup.yml) | Push to main + nightly | Post-Merge Cleanup |
| [issue-triage.yml](./issue-triage.yml) | Cron 2h weekdays + `issues` events | Issue Triage |

## Security

- Use `GITHUB_TOKEN` with minimum permissions
- No secrets in workflow logs
- See [safety.md](../../docs/safety.md)