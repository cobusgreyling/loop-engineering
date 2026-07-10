# Dependency Sweeper — Cursor (Automations / Agent)

This is a practical, copy-pasteable example of a dependency sweeper loop using Cursor.

Cursor has no native `/loop` scheduler (unlike Grok or Claude Code). Map the loop to a **Cloud Automation** (cron) or a recurring **Agent** prompt on cadence.

## Automation prompt (week one — report only)

In Cursor → Automations, create a job (e.g. every 6 hours) with a prompt like:

```text
Run the dependency-triage skill on the current project.
Read dependency-sweeper-state.md.
Scan package manifests and lockfiles for outdated and vulnerable dependencies.
Update dependency-sweeper-state.md with the top-priority findings.
Report only — do not modify any source files or lockfiles in week one.
Flag risky updates (major bumps, packages with breaking-change history) for human review
in dependency-sweeper-state.md.
```

Or invoke manually in Agent chat with the same prompt on your chosen cadence.

## Progression

- **Week one — report only.** Append findings to `dependency-sweeper-state.md`. Read it
  yourself before trusting the loop to act.
- **Patch-only after tuning.** Extend the automation to apply patch-only updates
  once the triage skill output looks reliable.
- **Worktree per attempt.** Create a fresh worktree for every fix attempt using
  `npx @cobusgreyling/loop-worktree`.
- **Verifier gate.** A separate verifier agent (`.cursor/skills/loop-verifier/SKILL.md`)
  reviews the diff and confirms tests pass before any merge proposal.
- **Human gate for majors.** Major version upgrades always require a human gate before
  any merge proposal.

## Requirements

- `dependency-sweeper-state.md` in the repo root (from `starters/dependency-sweeper/`)
- The `dependency-triage` skill in `.cursor/skills/dependency-triage/SKILL.md`
- The `loop-verifier` skill in `.cursor/skills/loop-verifier/SKILL.md`
- Optional always-on constraints in `.cursor/rules/`
- Cloud Automation for unattended cadence — manual Agent chat works for week one

## Example dependency-sweeper-state.md

```markdown
# Dependency Sweeper State
Last run: 2026-07-11 06:00 UTC

## Pending updates

### lodash 4.17.20 → 4.17.21 (patch)
- Severity: low
- Loop action: report only (week one). Candidate for patch-auto next cycle.
- Attempts: 0 / 3

### react 18.2.0 → 19.0.0 (major)
- Severity: high (breaking changes in hooks API)
- Loop action: escalated to human. Do not auto-apply.

## Denylist
- webpack (frozen at 5.x per team decision)
```

## Notes

- **Patch-only by default.** Never auto-merge majors or breaking changes — majors and
  breaking changes should stay human-gated.
- Maintain a `denylist` in `dependency-sweeper-state.md` of packages the loop must
  never touch.
- Create a fresh worktree for every fix attempt using `npx @cobusgreyling/loop-worktree`
  — never apply fixes directly to the working tree.
- The verifier skill (`.cursor/skills/loop-verifier/SKILL.md`) must run the full test
  suite and approve the diff before the loop proposes or merges any change.
- Max 3 fix attempts per package per run; pause after 5 auto-PRs per day.

## References

- [patterns/dependency-sweeper.md](../../patterns/dependency-sweeper.md)
- [docs/safety.md](../../docs/safety.md)
- [stories/dependency-sweeper-week-one.md](../../stories/dependency-sweeper-week-one.md)

See the [primitives matrix](../../docs/primitives-matrix.md) for how Cursor maps
to the same six-part loop shape.
