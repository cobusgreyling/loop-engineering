# Refactor / change path

**There is no “refactor the whole project” pattern.** That is deliberate. A multi-file rewrite sits in the high-risk zone in [safety.md](./safety.md) (denylist + max-files). Loop engineering’s job is to **decompose** that work and run each slice through a maker → verifier → human loop — not to L3 the tree overnight.

If you arrived from “I have a refactor, how do I break it into todos and automate it?” — this is the tutorial. Companion for run-until-done on a **scoped** objective: [goal-engineering](https://github.com/cobusgreyling/goal-engineering).

## The boundary

| This repo (loop-engineering) | Goal-engineering |
|------------------------------|------------------|
| Discovers work (triage), babysits PRs, sweeps CI | Finishes a named objective (`/goal`) |
| `STATE.md` is a queue | A goal has a done-definition and a verifier |
| Cadence loops (1d, 15m) | Run until the goal is met or the budget trips |

Use **both**: triage to list the slices, `/goal` (or a human) to implement one slice, PR babysitter to land it.

## Path (L1 → L2 → maybe later L3)

### 0. Scaffold, do not code

```bash
npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
npx @cobusgreyling/loop doctor .
```

Default `--tool` is `claude`. Use `opencode` for a CLI agent on cron; `grok` / `codex` work the same. This writes `STATE.md`, `LOOP.md`, `loop-budget.md`, `loop-run-log.md`, and constraints. **Week one: report only.**

### 1. Inventory (L1)

Run daily triage against the repo. The output belongs in `STATE.md` High Priority / Watch — dead code, missing tests, modules to split — **not** in a 40-file PR.

- Pattern: [daily-triage](../patterns/daily-triage.md)
- OpenCode: [examples/opencode/daily-triage.md](../examples/opencode/daily-triage.md)

A single High Priority line should be small enough for one PR (one module, one test gap, one rename). If it is not, split it before anyone codes.

### 2. One todo = one worktree = one PR (L2)

For each High Priority item:

1. `npx @cobusgreyling/loop-worktree create --run-id <id> --pattern pr-babysitter` (or a manual git worktree).
2. Implementer changes **only that slice**.
3. Independent verifier runs the project tests — not the same session, not “looks good”.
4. Human reviews the PR. The loop does not merge.

- Pattern: [pr-babysitter](../patterns/pr-babysitter.md)
- OpenCode: [examples/opencode/pr-babysitter.md](../examples/opencode/pr-babysitter.md) · starter: [starters/pr-babysitter-opencode](../starters/pr-babysitter-opencode/)
- Isolation: [loop-worktree](../tools/loop-worktree/) · [loop-sandbox](../tools/loop-sandbox/)

Optional: name the slice as a `/goal` in [goal-engineering](https://github.com/cobusgreyling/goal-engineering) so the agent has an explicit done-definition instead of “keep refactoring.”

### 3. Automate only what you already trust

After several L2 slices have landed with a real verifier:

- Formatting, tests-only, docs: may go on an auto-merge **allowlist** (`gate.yaml`).
- Core logic, public API, auth, payments: **denylist**, forever, human merge.
- Check [loop-design-checklist.md](./loop-design-checklist.md) before anything unattended.
- Do **not** jump to L3 on the refactor as a whole.

### 4. After each merge

[Post-merge cleanup](../patterns/post-merge-cleanup.md) for leftover TODOs and changelog noise. Then the next STATE.md line.

## Why not one L3 loop?

- Attempt caps exist because infinite fix loops are a known [failure mode](./failure-modes.md).
- `maxFiles` in `gate.yaml` will escalate a “rewrite src/” diff.
- A verifier in the same run as the implementer is theater.
- Token budget on a whole-repo rewrite will burn before the tests go green.

The valuable move is boring: **many small PRs**, each with a verifier, each with a human on the merge button until the allowlist has earned the right to grow.

## Related

- [jobs.md](./jobs.md) — if you wanted a different job
- [QUICKSTART.md](./QUICKSTART.md) — 5-minute scaffold
- [safety.md](./safety.md) — denylist / max-files
- [loop-design-checklist.md](./loop-design-checklist.md) — L3 gates
