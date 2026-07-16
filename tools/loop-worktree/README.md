# loop-worktree

Manage isolated [git worktrees](https://git-scm.com/docs/git-worktree) for loop engineering attempts. One worktree per fix attempt; mark it when the verifier rejects or a human escalates; sweep the discarded ones.

`LOOP.md` and `docs/primitives.md` describe this convention in prose ("one worktree per fix; discard after verifier REJECT or human escalation"). This tool is the code behind it: a shared place for worktrees to live, a manifest that tracks their status, and a reconciler that sweeps orphans.

## Install & Run

```bash
npx @cobusgreyling/loop-worktree create --run-id ci-sweeper-2026-07-07-01 --pattern ci-sweeper
npx @cobusgreyling/loop-worktree list
```

**From this repo:**

```bash
cd tools/loop-worktree
npm install
npm test
```

## Commands

```bash
loop-worktree create --run-id <id> --pattern <p> [--base main]
  # git worktree add -b loop/<id> .loop-worktrees/<id> <base>, records the manifest entry

loop-worktree mark --run-id <id> --status rejected
  # updates the manifest only (audit trail); does not delete the worktree

loop-worktree cleanup [--status rejected,escalated] [--older-than 24h] [--force]
  # git worktree remove for matching entries, then prunes them from the manifest

loop-worktree gc [--force] [--json]
  # reconciles `git worktree list` against the manifest:
  #   - on disk under .loop-worktrees/ but not in the manifest -> reported as an orphan
  #   - in the manifest but not on disk -> dropped from the manifest
  # report-only by default; --force removes orphans

loop-worktree list [--status active] [--json]

loop-worktree lock --paths <glob1,glob2,...> --owner <name> [--ttl 6h] [--wait 15m]
  # advisory lock: fails if another (non-expired) owner already holds an overlapping path
  # --wait queues instead of failing immediately; detects wait-for-graph deadlocks

loop-worktree unlock --owner <name>
  # releases that owner's lock; no-op if it didn't hold one

loop-worktree locks [--sweep] [--force] [--json]
  # lists active locks and wait intents; --sweep reports expired ones (report-only; --force deletes them)
```

## Status

An entry is one of: `active`, `rejected`, `escalated`, `merged`, `stale`.

`cleanup` sweeps `rejected` and `escalated` by default. `active` is never swept automatically.

## Safety

- `create` fails with a clear message (not a raw git error) if the directory is not a git repo, or if `--run-id` already has an active worktree.
- `cleanup` runs `git worktree remove` without `--force` first, so git refuses to delete a worktree with uncommitted or untracked changes; that entry is reported as skipped. Pass `--force` only when you accept the data loss.
- `gc` is report-only by default, matching the repo's convention that anything scanning broadly reports rather than acts.

## Preventing multi-loop collisions

Independently-scheduled loops can race on the same files -- see
[stories/multi-loop-collision.md](../../stories/multi-loop-collision.md) and
[stories/dependency-vs-ci-sweeper-collision.md](../../stories/dependency-vs-ci-sweeper-collision.md)
for real incidents this caused. `lock`/`unlock` give
[`docs/multi-loop.md`](../../docs/multi-loop.md)'s `acting_on` convention a
mechanical form:

```bash
loop-worktree lock --paths package.json,package-lock.json --owner dependency-sweeper --ttl 6h \
  || exit 2   # another owner holds an overlapping path -- skip this run
loop-worktree create --run-id "$RUN_ID" --pattern dependency-sweeper
# ... do the work ...
loop-worktree unlock --owner dependency-sweeper
```

It's deliberately advisory, not enforced by `create` itself -- a loop that
skips the `lock` call is not physically blocked, matching this repo's
existing "prose plus tooling" philosophy rather than hard sandboxing.
Locking is keyed on path globs, not run ids, so it also catches collisions
*across* different patterns (e.g. CI Sweeper and Dependency Sweeper both
touching `package.json`), not just within one.

`--paths` overlap is compared segment by segment (split on `/`): a wildcard
segment (`*` or `**`) is compatible with anything at that position, so
`src/**` overlaps `src/foo.ts`, but `docs/api` does not overlap
`docs/apidocs.md` (different literal segments, not just a shorter string).
This is intentionally simple (an advisory lock, not a full glob engine),
matching how `--older-than` already parses durations elsewhere in this tool.

Locks never expire on their own unless you pass `--ttl`; an orphaned lock
(owner crashed without unlocking) is surfaced -- not silently ignored -- by
`loop-worktree locks --sweep`, and only deleted with `--force`, mirroring
`gc`'s existing report-only-by-default convention for anything that scans
broadly instead of acting on one named target. `--owner` is restricted to
letters, digits, `.`, `_`, `-` (no path separators), since it names the lock
file directly. Concurrent `lock` calls are serialized through a short-lived
mutex file so two racing invocations can't both pass the overlap check
before either writes.

## Pairing with loop-context

A loop's control script that calls [`loop-context`](../loop-context) `--check` and escalates should also mark its worktree:

```bash
loop-worktree mark --run-id "$RUN_ID" --status escalated
```

The two tools stay independent: `loop-worktree` does not read the ledger, and `loop-context` does not know about git.

## Manifest

`.loop-worktrees/manifest.json` (add `.loop-worktrees/` to `.gitignore`):

```json
{
  "version": 1,
  "worktrees": [
    {
      "id": "ci-sweeper-2026-07-07-01",
      "path": ".loop-worktrees/ci-sweeper-2026-07-07-01",
      "branch": "loop/ci-sweeper-2026-07-07-01",
      "baseBranch": "main",
      "pattern": "ci-sweeper",
      "createdAt": "2026-07-07T08:00:00.000Z",
      "status": "active"
    }
  ]
}
```

## Locks

`.loop-worktrees/locks/<owner>.json`, one file per owner (also add
`.loop-worktrees/` to `.gitignore` -- it already covers this):

```json
{
  "owner": "dependency-sweeper",
  "paths": ["package.json", "package-lock.json"],
  "lockedAt": "2026-07-14T08:00:00.000Z",
  "expiresAt": "2026-07-14T14:00:00.000Z"
}
```

`expiresAt` is absent when no `--ttl` was given.

See [docs/primitives.md](../../docs/primitives.md) for where worktrees fit in the Five Building Blocks + Memory model.
