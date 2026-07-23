# Issue Triage — Cursor (Automations / Agent)

Keep the issue queue legible so morning triage and other loops always know the
top five actionable items. This example maps the
[Issue Triage](../../patterns/issue-triage.md) pattern to Cursor while keeping
**week one report-only**: propose labels and priority notes only — never
auto-close, auto-label, or assign without a human gate.

Cursor [Automations](https://cursor.com/changelog/03-05-26) can run on schedules
or GitHub issue events in a managed cloud sandbox. Cursor also has a local
[`/loop` skill](https://cursor.com/changelog/shared-canvases) for long-running
agents, but it does not create a repository-owned, reviewable schedule
manifest. Use a GitHub Action or another external scheduler when the cadence
must live with the repository.

## Setup

Copy the shared skill and state into Cursor's project-local paths:

```bash
mkdir -p .cursor/skills/issue-triage \
  .cursor/skills/loop-verifier
cp starters/issue-triage/.claude/skills/issue-triage/SKILL.md \
  .cursor/skills/issue-triage/SKILL.md
cp templates/SKILL.md.verifier \
  .cursor/skills/loop-verifier/SKILL.md
cp starters/issue-triage/issue-triage-state.md.example \
  issue-triage-state.md
```

Put always-on path denylists, “no auto-close / no auto-assign”, and attempt
limits in `.cursor/rules/` as well as in the Automation prompt. Prompts and
rules are advisory — tool scopes and credentials are the real boundary.

### Optional: GitHub MCP (read-only discovery)

For richer open-issue discovery without granting write access, wire the
read-only GitHub MCP example:

```bash
# See examples/mcp/github-readonly.mcp.json
# Use a fine-grained PAT with issues:read (and metadata) only.
```

Copy [`examples/mcp/github-readonly.mcp.json`](../mcp/github-readonly.mcp.json)
into your Cursor MCP config and replace `REPLACE_WITH_READ_ONLY_TOKEN` with a
**read-only** token. Do **not** use `github-propose.json` in week one.

## Automation prompt (week one — report only)

Create a scheduled Automation (e.g. every 2h or 1d), or a GitHub-triggered
Automation on `issues` / `discussion` events, with a prompt like:

```text
Run the issue-triage skill. Read issue-triage-state.md before scanning.
Discover open GitHub issues and discussions (via gh or read-only GitHub MCP).
Update issue-triage-state.md with:
- Top 5 prioritized items (P0–P3) with one-sentence summaries
- Suggested labels (proposed only — do not apply)
- Possible duplicates as "possible duplicate of #NNN" for human confirmation
- Needs-human bucket for ambiguous, security-sensitive, or auth/payments items

Week one is report-only:
- do not apply labels, assignees, or milestones;
- do not close, reopen, lock, or transfer issues;
- do not post comments on issues or discussions;
- do not create, edit, or merge pull requests;
- do not open or merge PRs that change code.

Escalate P0 (security, prod breakage, data loss) and any denylisted areas.
Stop after writing the state file when attribution or priority is unclear.
```

Review `issue-triage-state.md` after every run. Cursor Automations can
[open PRs by default](https://cursor.com/changelog/06-18-26). Remove write-
capable MCP and PR-opening tools where the configuration allows; otherwise run
without credentials that can mutate issues or open PRs, and export the state
diff as an artifact for a human to apply.

## Progression (only after tuning)

| Phase | Behavior |
|-------|----------|
| **Week one — L1** | Propose only. Human applies labels and closes noise. |
| **After ~10 stable runs** | Allowlisted labels only (`area:*`, `needs-repro`, `needs-info`) via a separate verifier session. Never auto-apply `P0`, `P1`, `security`, or `breaking-change`. |
| **Never without human** | Close, reassign, comment as the bot on security/public-API issues, or auto-merge related cleanup PRs. |

For L2 label apply:

1. Human approves the allowlist and the specific issue set.
2. A separate Agent session runs `loop-verifier` over the proposed label set.
3. Apply only labels that pass the verifier; record the result in state.
4. Stop after three failed verification rounds on the same item and escalate.

## Pairing with Daily Triage

Issue Triage runs more frequently (2h–1d) and produces a clean queue. Daily
Triage (1d) should **read** `issue-triage-state.md` and merge only the Top 5
issue numbers into `STATE.md` High Priority — do not paste full issue bodies.

## Example `issue-triage-state.md`

```markdown
# Issue Triage State
Last run: 2026-07-23 12:00 UTC
Open actionable: 11 (was 14)
New since last run: 2
Needs human: 1

## Top 5 (by loop score)
- #487 (bug, p1, 2d old) — "Crash on export with large files" — suggested: bug, needs-repro, area:export
- #491 (feature, p2) — "Dark mode for settings" — suggested: enhancement, area:ui

## Proposed Labels (not applied — L1)
- #487: bug, needs-repro, area:export
- #491: enhancement, area:ui

## Possible Duplicates (human confirm)
- #502 — possible duplicate of #487

## Noise / Ignored
- #300 marketing outreach (not product backlog)
```

## Safety

- **L1:** propose only — no auto-label, auto-close, auto-comment, or auto-assign.
- Denylist always human: auth, payments, security, public API, billing, infra.
- Duplicate matching is conservative; never close as duplicate without a human.
- See [docs/safety.md](../../docs/safety.md).

## References

- [Issue Triage starter](../../starters/issue-triage/)
- [Issue Triage pattern](../../patterns/issue-triage.md)
- [GitHub MCP read-only example](../mcp/github-readonly.mcp.json)
- [MCP cookbook](../mcp/README.md)
- [Safety and human gates](../../docs/safety.md)
- [Primitives matrix](../../docs/primitives-matrix.md)
