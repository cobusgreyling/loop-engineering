# Changelog Drafter Loop

**Goal**: Scan merged PRs, commits, and labels since the last release (or on a regular cadence), produce a high-quality, categorized draft of release notes or CHANGELOG entries. Human reviews and approves before the notes are published or the release is cut.

## Scheduling

**Recommended**:
- `/loop 1d` (morning or end-of-day) for active projects
- On release preparation: trigger manually or via tag webhook / GitHub Action (`on: [release, workflow_dispatch]`)
- Weekly for slower projects

This is an excellent "off-peak" or "end of sprint" loop. Low urgency compared to CI or PR babysitter.

## Required Skills

- `changelog-scan` — Discovers recent merges/PRs/commits, extracts titles, labels, linked issues, and breaking-change signals. Produces a structured list.
- `draft-release-notes` — Takes the scanned items + project conventions and produces clean, user-facing release notes (categorized: Features, Fixes, Breaking, Security, Docs, etc.).
- `loop-verifier` (or human review) — Checks the draft for accuracy, tone, completeness, and adherence to project voice. Never let the drafter grade its own output.

## State

Filename: `changelog-drafter-state.md`

Compact record of what has been scanned and what drafts are pending review:

```markdown
# Changelog Drafter State

Last run: 2026-06-09 18:30 UTC
Last release: v2.14.0 (tag 2026-06-01)

## Pending Drafts
- v2.15.0-rc (unreleased)
  Items scanned: 17 PRs + 4 direct commits
  Draft location: RELEASE_NOTES_DRAFT.md (or PR body)
  Status: ready for human review

## Recently Published
- v2.14.0 — published 2026-06-01 (reviewed by @cobus)
```

The loop should prune entries once a release is tagged/published and the draft is incorporated.

## How the Loop Runs (Typical Cycle)

1. Determine the "since" window (last tag, or last run date from state, or last N days).
2. `changelog-scan` lists merged PRs to main + noteworthy direct commits. Extracts conventional commit type, labels (e.g. `breaking`, `security`), linked issues.
3. Group items into standard sections (Features, Bug Fixes, Performance, Breaking Changes, Security, Documentation, Internal / Chores).
4. `draft-release-notes` writes a polished markdown draft (with links, thanks to contributors, upgrade notes where obvious).
5. Verifier (or human) reviews the draft for:
   - Accuracy (no invented features)
   - Completeness (high-impact items not omitted)
   - Tone and project voice
6. On approval: the loop can open a PR that updates `CHANGELOG.md` (or the GitHub release body), or simply leave the draft in a file for the maintainer to copy.
7. Record the run + mark items as "published" in state. Prune old entries.
8. Record post-run critique in state: missed items, false positives, grouping issues, retries, and prompt/policy adjustments for next run.

## Post-Run Critique

After the human reviews the draft, the human reviewer or operator records what the previous run missed or misclassified so the next run improves. This captures review findings from the last draft run.

Record in state under a `## Post-Run Critique` heading:

- **Missed items** — Changes users reported that the draft omitted
- **False positives** — Items in the draft that should not have been user-facing (chores, infra-only)
- **Grouping issues** — Items in the wrong section (e.g., a fix in Features)
- **Retries** — Number of times the draft was revised or regenerated (+ reason)
- **Prompt/policy adjustments** — 1–2 concrete changes to scan, draft, or verifier skill instructions for the next run

Optional but recommended during L1 dogfood runs. Even occasional critique entries help prevent repeat issues.

## Verification Strategy

- The drafter never publishes. It proposes.
- A separate verifier skill (or the human) must approve the draft.
- For automated PRs that update CHANGELOG: the PR must pass the project's normal review gates (or be explicitly allowlisted for this loop).
- Prefer human eyes on the first few runs and on any release that contains breaking changes.

## Human Handoff Points

- Any breaking change or security note
- Major version bumps
- Releases with heavy marketing / external communication needs
- Drafts the loop has produced that the human has not reviewed after N days
- When the scan window contains > ~50 items (too much for one release — split or human curate)

## Tool-Specific Notes

**Grok Build TUI**:
```bash
/loop 1d Run changelog-scan on merges since last tag or last state date. Produce a categorized draft in RELEASE_NOTES_DRAFT.md using draft-release-notes. Update changelog-drafter-state.md. Do not commit/publish without human approval.
```

**Claude Code**:
```bash
/loop 1d Scan recent merges and draft release notes. Write draft to RELEASE_NOTES_DRAFT.md + update state. Flag breaking/security items for review.
```

**Codex**:
- Automation: daily "Changelog Drafter" that calls the scan + draft skills and posts the draft to a Triage inbox or a dedicated release-prep issue.

**GitHub Actions**:
- See `examples/github-actions/` for a workflow that can be triggered on push to main or `workflow_dispatch`. It can comment the draft on a release tracking issue or create a draft PR.

## Failure Modes & Mitigations

| Failure | Mitigation |
|---------|------------|
| Hallucinated features or wrong attribution | Verifier cross-checks every item against actual PR titles + commit messages. State tracks source PRs. |
| Missing important changes | Scan both PRs *and* direct commits on main. Use labels + conventional commits. |
| Overly long / noisy notes | Strict categorization + "user-facing only" rule in the draft skill. Human can trim. |
| Tone mismatch with project | Provide a short "Release voice" section in AGENTS.md or a project skill that the drafter reads. |
| Accidentally publishing | Never grant the loop write access to tags or the live CHANGELOG without an explicit human gate + PR. |
| Stale critique / never reviewed | Add a human handoff when critique entries accumulate without resolution across a threshold (e.g., 3 runs). |

## Cost Profile

| Scenario | Tokens/run | Notes |
|----------|------------|-------|
| No-op (no new merges) | ~5k | Exit when nothing since last tag |
| Scan + categorize | ~35k | PR/commit scan |
| Draft + verify | ~80k | Categorized release notes draft |

**Cadence**: 1d · **Tier**: low · **Suggested daily cap**: 100k tokens

```bash
npx @cobusgreyling/loop-cost --pattern changelog-drafter --level L1
```

One of the cheapest high-value loops. Safe to run alongside others.

## Success Metrics

- Time from "last merge" to "published release notes" (target: < 1 day for patch releases)
- % of releases that include notes on first publish (no "we forgot the changelog again")
- Human review time per release (should drop after the loop learns project voice)
- Number of "surprise" items found by users that were missing from notes (target: near zero)

This is one of the highest-ROI, lowest-risk loops. Excellent as a second or third loop once Daily Triage is stable. It directly improves the experience for every user and contributor.

See the [pattern picker](../docs/pattern-picker.md) for when to introduce it alongside Post-Merge Cleanup.