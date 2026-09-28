# Failure Mode Catalog

Real ways loops fail — and how good design mitigates them. Use this when debugging a misbehaving loop or writing a new pattern.

## Classification

| Severity | Meaning |
|----------|---------|
| **S1 — Annoying** | Wasted time/tokens, no user harm |
| **S2 — Harmful** | Wrong code merged, bad tickets, alert fatigue |
| **S3 — Critical** | Security, data loss, production incident |

---

## Infinite Fix Loop

**Symptom**: Same PR or CI job gets automated fix attempts 5+ times; never converges.

**Severity**: S2

**Causes**:
- Verifier too weak or same session as implementer
- Root cause misdiagnosed (symptom fixing)
- Flaky test treated as regression

**Mitigations**:
- Hard cap on attempts (e.g. 3) → escalate to human
- Separate verifier model / higher reasoning effort
- Classify flakes in triage; quarantine instead of code change
- Record attempt count in state file

---

## State Rot

**Symptom**: `STATE.md` references merged PRs, closed tickets, or stale branches.

**Severity**: S1 → S2 (loop acts on ghosts)

**Causes**:
- No prune step at end of run
- State file not read at start
- Multiple loops writing same file without schema

**Mitigations**:
- Prune closed/merged items every run
- `Last run` timestamp + validate IDs against live API
- One state file per loop pattern, or clear sections

---

## Verifier Theater

**Symptom**: Verifier "approves" but tests fail in CI or review finds obvious bugs.

**Severity**: S2

**Causes**:
- Verifier prompt too vague ("looks good")
- Verifier doesn't run tests
- Same model, same context as implementer

**Mitigations**:
- Verifier must run test/lint commands and report output
- Different instructions: "find reasons to reject"
- Stronger model on verifier for unattended loops

---

## Notification Fatigue

**Symptom**: Slack/email pings every 5 minutes; team mutes the bot.

**Severity**: S1 → S2 (real escalations missed)

**Causes**:
- Notify on every run, not every *actionable* finding
- Low bar for "high priority" in triage skill

**Mitigations**:
- Notify only when human decision required
- Digest mode for report-only loops
- Tighten triage "High Priority" rules

---

## Token Burn

**Symptom**: Bill spikes; loop runs full sub-agent chains on empty or noisy triage.

**Severity**: S1

**Causes**:
- Sub-minute cadence with heavy sub-agents
- No early exit when watchlist empty
- Retrying entire pipeline on transient API errors

**Mitigations**:
- Cheaper triage-only pass first; spawn sub-agents only for actionable items
- `scheduler_delete` when nothing to watch
- Daily token budget → pause loop
- See [operating-loops.md](./operating-loops.md)

---

## Over-Reach (Wrong Scope)

**Symptom**: Loop refactors unrelated modules, "fixes" design issues, or touches denylisted paths.

**Severity**: S2 → S3

**Causes**:
- minimal-fix skill too permissive
- No path allowlist/denylist
- Triage puts architectural work in "High Priority"

**Mitigations**:
- [safety.md](./safety.md) denylist enforced in skills
- "Smallest possible diff" + verifier checks touched files
- Triage skill: signal only, no invention

---

## Comprehension Debt Spiral

**Symptom**: Velocity up, but no one can explain recent changes; review becomes rubber-stamp.

**Severity**: S2 (long-term)

**Causes**:
- Human stops reading loop output
- Auto-merge on growing allowlist
- No weekly human synthesis of loop actions

**Mitigations**:
- Mandatory human review for non-trivial PRs
- Weekly "loop digest" read by owner
- Cap auto-merge to truly trivial paths

---

## Cognitive Surrender

**Symptom**: "The loop handles it" — no opinions on correctness or design.

**Severity**: S2 (cultural)

**Causes**:
- Loop success metric = volume, not quality
- No human gates on medium-risk work

**Mitigations**:
- Explicit human gates in every pattern
- Success metric: time saved *with* quality bar held
- Osmani: "Build it like someone who intends to stay the engineer"

---

## Parallel Collision

**Symptom**: Two sub-agents edit same files; merge conflicts; corrupted state.

**Severity**: S2

**Causes**:
- No worktree isolation
- Two loops acting on same PR without coordination

**Mitigations**:
- `isolation: worktree` for all code-editing sub-agents
- Lock or queue in state: "PR #1234 — worktree in progress"

---

## Escalation Failure

**Symptom**: Loop stuck retrying; human never notified.

**Severity**: S2

**Causes**:
- Max attempts not implemented
- Escalation only writes to state no one reads

**Mitigations**:
- Connector ping on escalation (Slack, Linear comment)
- `High Priority (waiting on human)` section in STATE.md
- Alert if item in that section >24h

---

## Prompt Injection via Untrusted Input

**Symptom**: The loop does something no one asked for — runs a command, edits a file, approves a change, or relabels an issue — because text in an issue, PR, review comment, CI log or dependency changelog told it to.

**Severity**: S3

**Causes**:
- Loops read text written by people outside the loop, and the model cannot reliably tell data from instructions
- Third-party text copied into a state file looks like the loop's own notes on the next run
- Hidden text: HTML comments and invisible Unicode (zero-width characters, the U+E0000 tag block) render as nothing for a human reviewer but are read by the model
- Skills that never say which inputs are untrusted

**Mitigations**:
- Every skill that reads third-party text says it is data, not instructions — see [Untrusted input](./safety.md#untrusted-input)
- Render third-party text inertly in state files: code spans, invisible characters stripped, length capped
- Least-privilege tokens and the path denylist, so an injected instruction has little it can reach
- Human review of anything the loop merges; flagged items escalate rather than act

---

## Contributing Failures

Have a story? Add a row via PR to this doc or open an issue with:
- Pattern name
- Symptom
- What mitigated it (or didn't)