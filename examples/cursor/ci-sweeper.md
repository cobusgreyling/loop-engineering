# CI Sweeper — Cursor (Automations / Agent)

This example maps the CI Sweeper loop to Cursor while keeping week one
report-only. Cursor [Automations](https://cursor.com/changelog/03-05-26) can run
on schedules or GitHub events in a managed cloud sandbox. Cursor also has a
local [`/loop` skill](https://cursor.com/changelog/shared-canvases) for
long-running agents, but it does not create a repository-owned, reviewable
schedule manifest. Use a GitHub Action or another external scheduler when the
cadence must live with the repository.

## Setup

Copy the shared skills and state into Cursor's project-local paths:

```bash
mkdir -p .cursor/skills/ci-triage \
  .cursor/skills/minimal-fix \
  .cursor/skills/loop-verifier
cp starters/ci-sweeper/.claude/skills/ci-triage/SKILL.md \
  .cursor/skills/ci-triage/SKILL.md
cp templates/SKILL.md.minimal-fix \
  .cursor/skills/minimal-fix/SKILL.md
cp templates/SKILL.md.verifier \
  .cursor/skills/loop-verifier/SKILL.md
cp starters/ci-sweeper/ci-sweeper-state.md.example \
  ci-sweeper-state.md
```

Put always-on path denylists, attempt limits, and the no-auto-merge rule in
`.cursor/rules/` as well as in the Automation prompt.

## Automation prompt (week one — report only)

Create a scheduled or GitHub-triggered Automation with a prompt like:

```text
Run the ci-triage skill against the latest failing checks on the default branch.
Read ci-sweeper-state.md before classifying each failure.
Record the check URL, failing job or test, first failing commit, confidence,
and whether the failure is a regression, flake, infrastructure issue, or unknown.
Update ci-sweeper-state.md with the evidence and proposed next action.

Week one is report-only:
- do not edit source files or workflow files;
- do not create a worktree, branch, commit, pull request, or CI retry;
- do not post comments or change check status;
- do not merge or enable auto-merge.

Escalate security, release, permissions, secrets, and infrastructure failures.
Stop after reporting when the root cause is ambiguous.
```

Review the state file after every run. A prompt and `.cursor/rules` are not
permission boundaries: remove write-capable MCP and PR-opening tools where the
configuration allows, then use GitHub branch protection and least-privilege
repository access as backstops. Cursor Automations can
[open PRs by default](https://cursor.com/changelog/06-18-26). If that capability
cannot be removed, do not grant credentials that can push branches or open or
merge PRs; export the state change as an artifact for a human to apply instead.

## L2 fix attempts (only after tuning)

After the report-only output is consistently accurate, allow one narrowly
scoped fix only for a confirmed repository regression:

1. A human approves the failing check, allowed paths, and validation command.
2. Create an isolated attempt with
   `npx @cobusgreyling/loop-worktree create --run-id <run-id> --pattern ci-sweeper`.
3. Run `minimal-fix` in that worktree; never edit the main checkout.
4. Run `loop-verifier` in a separate Agent session over the diff and test output.
5. On rejection, mark and discard the attempt. On approval, present the diff to
   a human for the final decision.

Never enable auto-merge. Stop after three attempts on one root cause and
escalate with the collected evidence.

## Example `ci-sweeper-state.md`

```markdown
# CI Sweeper State
Last run: 2026-07-23 06:00 UTC
Mode: report-only

## Failing checks

### validate / unit-tests
- URL: https://github.com/example/project/actions/runs/123
- First failing commit: abc1234
- Classification: likely regression (medium confidence)
- Evidence: test `parses empty input` fails consistently on two runs
- Proposed action: human review before an isolated fix attempt
- Attempts: 0 / 3

## Escalated
- deploy-production: permissions failure; no automated retry or fix
```

## References

- [CI Sweeper pattern](../../patterns/ci-sweeper.md)
- [CI Sweeper starter](../../starters/ci-sweeper/)
- [`loop-worktree`](../../tools/loop-worktree/)
- [Safety and human gates](../../docs/safety.md)
