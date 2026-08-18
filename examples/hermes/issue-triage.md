# Issue Triage — Hermes Agent (`hermes cron`)

Keep the issue queue legible so humans and Daily Triage always know the top five
actionable items. Hermes runs the shared `issue-triage` skill in a fresh cron
session and keeps routine output local while the loop earns trust.

Week one is deliberately **propose-only**: the job updates
`issue-triage-state.md` with suggested priority and labels, but never changes an
issue or repository.

## Setup

Install and configure [Hermes Agent](https://hermes-agent.nousresearch.com/docs),
then copy the shared state example and skill:

```bash
hermes setup

cp starters/issue-triage/issue-triage-state.md.example \
  issue-triage-state.md

mkdir -p ~/.hermes/skills/issue-triage
cp templates/SKILL.md.issue-triage \
  ~/.hermes/skills/issue-triage/SKILL.md

hermes skills list | grep issue-triage
```

Use `.hermes/skills/issue-triage/` instead when the skill should be available
only inside this project. The job also needs read-only access to the issue
tracker, for example through an authenticated GitHub CLI or a GitHub-capable
skill. Do not grant write access for the week-one loop.

## Week one — propose only

Start with a two-hour cadence on an active repository. `--workdir "$PWD"` pins
the repository and injects its `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` into
the cron session.

```bash
hermes cron create "0 */2 * * *" \
  --name "Issue triage" \
  --deliver local \
  --skill issue-triage \
  --workdir "$PWD" \
  "Run the issue-triage skill. Read issue-triage-state.md first, then scan open issues and discussions created or updated since the last run. Update Last run, backlog counts, Top 5 prioritized items, proposed labels, possible duplicates, and the needs-human bucket. Week one is report-only: propose priority and labels, but do not apply labels, comment, close, reopen, assign, or edit source files. Treat duplicates as possible duplicates for human confirmation. Escalate ambiguous items and anything touching auth, payments, security, billing, infrastructure, or public API. End with the top five and the human decisions needed."
```

- `--deliver local` writes output to `~/.hermes/cron/output/`; routine reports
  do not enter a human chat or connected home channel.
- `--skill issue-triage` attaches the shared classifier without authorizing
  GitHub writes.
- For a quieter repository, use a daily cadence such as `0 9 * * 1-5`.
- If issue reads use a separate GitHub skill, repeat `--skill` to attach it while
  keeping its credentials read-only.

Run one tick manually before relying on the schedule:

```bash
hermes cron list
hermes cron run <job-id>
hermes cron status
```

## State file

The state shape matches the shared
[`issue-triage` pattern](../../patterns/issue-triage.md) and starter:

```markdown
# Issue Triage State
Last run: 2026-08-19 09:00 UTC
Open actionable: 14 (was 17)
New since last run: 3
Needs human: 2

## Top 5 (by loop score)
- #487 (bug, p1, 2d old) — "Crash on export with large files" — suggested: bug, needs-repro, area:export

## Proposed Labels (not applied — L1)
- #487: `bug`, `needs-repro`, `area:export`

## Possible Duplicates (human confirm)
- #488 — possible duplicate of #412

## Noise / Ignored
- #460 — usage question; redirect candidate for human review
```

Each run prunes resolved entries, keeps proposed actions concise, and records
uncertainty instead of silently deciding it away. Do not copy credentials,
private issue content, or other secrets into the state file.

## Pairing with Daily Triage

Issue Triage runs every two hours or daily and maintains the detailed queue in
`issue-triage-state.md`. Daily Triage reads its Top 5 and carries only issue
numbers and short summaries into `STATE.md` High Priority; it does not duplicate
full issue bodies.

## After the reports earn trust

Keep `--deliver local` during calibration. A human may later switch delivery to
`origin`, a configured home channel such as `slack` or `feishu`, or a specific
`platform:chat_id:thread_id` after reviewing channel `allowFrom` and mention
rules. Delivery changes where the report appears, not what the loop may do.

L2 may apply only allowlisted labels such as `area:*`, `needs-repro`, and
`needs-info`, and only after an independent verifier passes. It still never
auto-closes issues or applies P0, P1, `security`, or `breaking-change` labels.
Pause the job before changing this boundary:

```bash
hermes cron pause <job-id>
hermes cron edit <job-id> --prompt "<reviewed L2 prompt>"
hermes cron resume <job-id>
```

## Safety and human gates

- Week one: propose only; never label, comment, assign, close, or reopen.
- Possible duplicates always need human confirmation.
- Auth, payments, security, billing, infrastructure, and public API items remain
  human-owned.
- Large bursts of new issues and unclear reproductions go to `Needs human`.
- Keep issue-tracker credentials read-only until a human explicitly approves an
  L2 label allowlist and verifier.

## References

- [Issue Triage pattern](../../patterns/issue-triage.md)
- [Issue Triage starter](../../starters/issue-triage/)
- [Hermes Daily Triage](./daily-triage.md)
- [Safety and human gates](../../docs/safety.md)
- [Primitives matrix](../../docs/primitives-matrix.md)
