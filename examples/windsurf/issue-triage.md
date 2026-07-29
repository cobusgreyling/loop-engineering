# Issue Triage — Windsurf (Cascade Workflows)

This is a practical, copy-pasteable example of an Issue Triage loop using Windsurf's Cascade. Low-risk companion to [Daily Triage](./daily-triage.md). Keeps the issue queue legible so morning triage and humans always know the top five.

Windsurf has no native `/loop` scheduler or built-in cron. Map the loop to a **Cascade Workflow** (`.windsurf/workflows/issue-triage.md`) and invoke it manually with `/issue-triage`; if you need an unattended cadence (e.g. 2h–1d), pair it with an external reminder or trigger (such as GitHub Actions cron, `launchd`, `cron`, or systemd) that prompts a human to run the workflow.

## Setup

Copy the shared skills and state into Windsurf's project-local paths:

```bash
mkdir -p .windsurf/rules/issue-triage \
  .windsurf/rules/loop-verifier
cp templates/SKILL.md.issue-triage \
  .windsurf/rules/issue-triage/SKILL.md
cp templates/SKILL.md.verifier \
  .windsurf/rules/loop-verifier/SKILL.md
cp starters/issue-triage/issue-triage-state.md.example \
  issue-triage-state.md
```

Put always-on path denylists, label allowlists, and the no-auto-label rule in `.windsurf/rules/` as well as in the workflow prompt.

## Workflow (week one — propose only)

Create `.windsurf/workflows/issue-triage.md`:

```markdown
# Issue Triage

**Description:** Discover open issues, propose priority (P0–P3) and labels, update state. Report only, no auto-apply or close.

1. Read `issue-triage-state.md` and `.windsurf/rules/issue-triage/SKILL.md`.
2. Scan open issues and discussions since the last run.
3. Record top 5 prioritized items (P0–P3) with one-sentence summaries.
4. Record suggested labels (proposed only — do not apply).
5. Flag potential duplicates as "possible duplicate of #NNN" for human confirmation.
6. Update `issue-triage-state.md` with evidence and human review items.
7. Week one is propose-only:
   - do not apply labels, close issues, or post comments;
   - do not modify source files or workflow files;
   - escalate P0/P1 issues touching security, auth, payments, or public APIs to a human.
```

Invoke in Cascade chat with `/issue-triage`.

For an unattended cadence, keep Windsurf as the triage/review surface and use an external scheduler only to remind a human or trigger execution. Review the state file after every run. See [Safety and human gates](../../docs/safety.md) for permission boundaries.

## Progression to L2 (auto-label allowlisted labels)

After the propose-only output is consistently accurate (e.g. 10 stable L1 runs), enable auto-applying allowlisted labels:

1. A human approves the allowlisted label scope (`area:*`, `needs-repro`, `needs-info`).
2. Run `loop-verifier` (`.windsurf/rules/loop-verifier/SKILL.md`) in a separate session/verifier step over proposed label changes.
3. Auto-apply only allowlisted labels after verifier passes.
4. Never auto-apply P0, P1, security, or breaking-change labels. Never close or comment on issues without human approval.

## Example `issue-triage-state.md`

```markdown
# Issue Triage State
Last run: 2026-07-28 09:00 UTC
Open actionable: 14 (was 17)
New since last run: 3
Needs human: 2

## Top 5 (by loop score)

- #487 (bug, p1, 2d old) — "Crash on export with large files" — suggested: bug, needs-repro, area:export
- #491 (feature, p2) — "Dark mode for settings" — suggested: enhancement, area:ui
- #488 (duplicate?) — possible duplicate of #412 — human confirm

## Proposed Labels (not applied — L1)

- #487: `bug`, `needs-repro`, `area:export`
- #491: `enhancement`, `area:ui`

## Possible Duplicates (human confirm)

- #488: possible duplicate of #412

## Noise / Ignored

- (none)

## Allowlisted labels (L2 only)

`area:*`, `needs-repro`, `needs-info`

## Denylist (always human)

auth, payments, security, public-api, breaking-change
```

## Pairing with Daily Triage

Issue Triage runs more frequently (2h–1d) and maintains a clean queue. Daily Triage (`/daily-triage`) reads `issue-triage-state.md` and merges top items into `STATE.md` High Priority.

## References

- [Issue Triage pattern](../../patterns/issue-triage.md)
- [Issue Triage starter](../../starters/issue-triage/)
- [Safety and human gates](../../docs/safety.md)
- [Primitives matrix](../../docs/primitives-matrix.md#appendix-editor-transfer-recipes-opencode-cursor--windsurf)
