# Dependency Sweeper — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of a Dependency Sweeper loop using Windsurf's Cascade.

Windsurf has no native `/loop` scheduler or built-in cron. Map the loop to a **Cascade Workflow** (`.windsurf/workflows/dependency-sweeper.md`) and invoke it manually with `/dependency-sweeper`; if you need an unattended cadence (e.g. 6h–1d), pair it with an external reminder or trigger (such as GitHub Actions cron, `launchd`, `cron`, or systemd) that prompts a human to run the workflow.

## Setup

Copy the shared skills and state into Windsurf's project-local paths:

```bash
mkdir -p .windsurf/rules/dependency-triage \
  .windsurf/rules/minimal-fix \
  .windsurf/rules/loop-verifier
cp starters/dependency-sweeper/.claude/skills/dependency-triage/SKILL.md \
  .windsurf/rules/dependency-triage/SKILL.md
cp templates/SKILL.md.minimal-fix \
  .windsurf/rules/minimal-fix/SKILL.md
cp templates/SKILL.md.verifier \
  .windsurf/rules/loop-verifier/SKILL.md
cp starters/dependency-sweeper/dependency-sweeper-state.md.example \
  dependency-sweeper-state.md
```

Put always-on path denylists, package denylists, and auto-bump restrictions in `.windsurf/rules/` as well as in the workflow prompt.

## Workflow (week one — report only)

Create `.windsurf/workflows/dependency-sweeper.md`:

```markdown
# Dependency Sweeper

**Description:** Audit package manifests/lockfiles for outdated dependencies and vulnerabilities. Report only, no auto-fix.

1. Read `dependency-sweeper-state.md` and `.windsurf/rules/dependency-triage/SKILL.md`.
2. Run the `dependency-triage` skill on package manifests and lockfiles.
3. Group findings by risk level (patch, minor, major, known CVEs).
4. Update `dependency-sweeper-state.md` with top findings and patch-only proposal notes.
5. Week one is report-only:
   - do not edit package manifests (`package.json`, etc.) or lockfiles;
   - do not open pull requests or push commits;
   - escalate major version bumps (no silent major bumps) and high-severity CVEs to a human.
```

Invoke in Cascade chat with `/dependency-sweeper`.

For an unattended cadence, keep Windsurf as the review/triage surface and use an external scheduler only to remind a human or trigger execution. Review the state file after every run. See [Safety and human gates](../../docs/safety.md) for permission boundaries.

## L2 progression (patch-only + circuit breaker)

After the report-only triage output is consistently accurate, allow patch-only fixes for safe updates:

1. Create a fresh worktree per attempt using `npx @cobusgreyling/loop-worktree create --run-id <run-id> --pattern dependency-sweeper`. Never edit the main working tree directly.
2. Apply minimal version updates (`minimal-fix`) only for allowlisted patch updates.
3. Run `loop-verifier` (`.windsurf/rules/loop-verifier/SKILL.md`) in a separate session/verifier step over tests and build.
4. **Circuit breaker & budget:** Before retrying any attempt on a package, run the circuit breaker:
   ```bash
   npx @cobusgreyling/loop-context --check --ledger loop-ledger.json \
     --budget-from-pattern dependency-sweeper --budget-level L2
   ```
   If the attempt cap is reached or circuit breaker triggers, stop retrying and escalate to a human. Respect the daily token cap defined in `loop-budget.md` (suggested: 500k tokens).
5. **Major bumps:** Major version bumps always require human approval before any merge proposal. Never silently apply major version upgrades.

## Example `dependency-sweeper-state.md`

```markdown
# Dependency Sweeper State
Last run: 2026-07-11 06:00 UTC
Mode: report-only

## Pending updates

### lodash 4.17.20 → 4.17.21 (patch)
- Severity: low
- Loop action: report-only (week one). Candidate for patch-auto next cycle.
- Attempts: 0 / 3

### react 18.2.0 → 19.0.0 (major)
- Severity: high (breaking changes in hooks API)
- Loop action: escalated to human. Do not auto-apply major bump.

## Denylist
- webpack (frozen at 5.x per team decision)
```

## References

- [Dependency Sweeper pattern](../../patterns/dependency-sweeper.md)
- [Dependency Sweeper starter](../../starters/dependency-sweeper/)
- [`loop-worktree`](../../tools/loop-worktree/)
- [Safety and human gates](../../docs/safety.md)
- [Primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf)
