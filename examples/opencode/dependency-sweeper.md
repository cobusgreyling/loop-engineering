# Dependency Sweeper — Opencode

Discover, safely apply, and verify dependency updates. opencode handles this well because `npm audit` and `cargo audit` are CLI-first tools the agent can invoke inside isolated worktrees.

## Prerequisites

```bash
mkdir -p skills/dependency-triage skills/loop-verifier skills/minimal-fix
cp templates/SKILL.md.loop-triage skills/dependency-triage/SKILL.md   # adapt for dep scan
cp templates/SKILL.md.verifier skills/loop-verifier/SKILL.md
cp templates/SKILL.md.minimal-fix skills/minimal-fix/SKILL.md
cp starters/minimal-loop-opencode/opencode.json.example opencode.json
cp starters/dependency-sweeper-opencode/dependency-sweeper-state.md.example dependency-sweeper-state.md
```

## L1 — Report Mode (Week 1)

```bash
opencode run \
  "Run skills/dependency-triage/SKILL.md. Read dependency-sweeper-state.md. Scan package manifests and lockfiles for outdated and vulnerable deps. Report findings only — do not edit any files. Update state with the top-priority items." \
  --title "Dependency sweeper"
```

Cron (6h cadence):

```cron
0 */6 * * * cd /repo && opencode run "Run dependency-triage on package manifests. Report outdated deps and CVEs. Update state. No fixes."
```

## L2 — Patch-Only Auto-Fix (Week 3+)

After tuning the triage skill, enable patch-only auto-fixes with a verifier gate:

```bash
FIX_ID="$(date +%Y%m%d%H%M%S)"
WORKTREE="../wt-depfix-$FIX_ID"
git worktree add "$WORKTREE" -b "loop/depfix-$FIX_ID"
opencode run \
  "Run dependency-triage. For the highest-severity patch-only upgrade (not a major bump): apply the fix in this worktree, run npm ci && npm test, commit the change, and output the diff path. Never touch denylisted packages. Escalate majors and high-sev CVEs to a human." \
  --agent implementer \
  --dir "$WORKTREE"
DIFF_FILE="$(mktemp /tmp/depfix.XXXXXX.patch)"
git -C "$WORKTREE" diff > "$DIFF_FILE"
opencode run "Review this dependency patch diff. Verify tests pass and no denylisted packages are touched. APPROVE or REJECT only." \
  --agent verifier \
  --file "$DIFF_FILE"
```

## Verification Split

| Role | Opencode shape |
|------|----------------|
| Triage | `skills/dependency-triage/SKILL.md` |
| Implementer | `opencode run "..." --agent implementer --dir <worktree>` (patch-only) |
| Verifier | `opencode run "Verify diff" --agent verifier --file <diff.patch>` (must run full test suite) |

## Safety

- **Patch-only by default.** Majors and breaking changes always escalate to a human.
- Maintain a denylist in `dependency-sweeper-state.md` of packages the loop must never touch.
- Max 3 fix attempts per run; pause after 5 auto-PRs per day.
- Verifier must run `npm ci && npm test` (or equivalent) before approving.

## References

- [patterns/dependency-sweeper.md](../../patterns/dependency-sweeper.md)
- [docs/safety.md](../../docs/safety.md)
- [stories/dependency-sweeper-week-one.md](../../stories/dependency-sweeper-week-one.md)
