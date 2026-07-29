# CI Sweeper — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a CI Sweeper loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler or built-in cron. Map the loop to a **Cascade Workflow** (`.windsurf/workflows/ci-sweeper.md`) and invoke it manually with `/ci-sweeper`; if you need an unattended cadence, pair it with an external reminder or trigger (such as GitHub Actions cron, `launchd`, `cron`, or systemd) that prompts a human to run the workflow.

## Setup

Copy the shared skills and state into Windsurf's project-local paths:

```bash
mkdir -p .windsurf/rules/ci-triage \
  .windsurf/rules/minimal-fix \
  .windsurf/rules/loop-verifier
cp starters/ci-sweeper/.claude/skills/ci-triage/SKILL.md \
  .windsurf/rules/ci-triage/SKILL.md
cp templates/SKILL.md.minimal-fix \
  .windsurf/rules/minimal-fix/SKILL.md
cp templates/SKILL.md.verifier \
  .windsurf/rules/loop-verifier/SKILL.md
cp starters/ci-sweeper/ci-sweeper-state.md.example \
  ci-sweeper-state.md
```

Put always-on path denylists, attempt limits, and the no-auto-merge rule in `.windsurf/rules/` as well as in the workflow prompt.

## Workflow (week one — report only)

Create `.windsurf/workflows/ci-sweeper.md`:

```markdown
# CI Sweeper

**Description:** Inspect failing CI checks, classify failures, update state. Report only, no auto-fix.

1. Read `ci-sweeper-state.md` and `.windsurf/rules/ci-triage/SKILL.md`.
2. Run the `ci-triage` skill against the latest failing checks on the default branch.
3. Record the check URL, failing job or test, first failing commit, confidence, and whether the failure is a regression, flake, infrastructure issue, or unknown.
4. Update `ci-sweeper-state.md` with evidence and proposed next action.
5. Week one is report-only:
   - do not edit source files or workflow files;
   - do not create a worktree, branch, commit, pull request, or CI retry;
   - do not post comments or change check status;
   - do not merge or enable auto-merge.
6. Escalate security, release, permissions, secrets, and infrastructure failures. Stop after reporting when root cause is ambiguous.
```

Invoke in Cascade chat with `/ci-sweeper`.

For an unattended cadence, keep Windsurf as the reviewer/triage surface and use an external scheduler only to remind a human or trigger execution. Review the state file after every run. See [Safety and human gates](../../docs/safety.md) for permission boundaries and least-privilege guidelines.

## L2 fix attempts (only after tuning)

After the report-only output is consistently accurate, allow one narrowly scoped fix attempt for a confirmed repository regression:

1. A human approves the failing check, allowed paths, and validation command.
2. Create an isolated attempt with `npx @cobusgreyling/loop-worktree create --run-id <run-id> --pattern ci-sweeper`.
3. Run `minimal-fix` (`.windsurf/rules/minimal-fix/SKILL.md`) in that worktree; never edit the main checkout directly.
4. Run `loop-verifier` (`.windsurf/rules/loop-verifier/SKILL.md`) in a separate session/verifier step over the diff and test output.
5. On rejection, mark and discard the attempt. On approval, present the diff to a human for the final decision.

Never enable auto-merge. Stop after three attempts on one root cause and escalate with the collected evidence.

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
- [Primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf)
