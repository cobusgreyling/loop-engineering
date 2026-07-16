# Week Two with loop-worktree: PR Babysitter, one fix at a time

**Pattern:** PR Babysitter
**Tool:** loop-worktree (paired with loop-context)

## What I was doing

I was running a small PR Babysitter loop: watch a PR, try a fix in isolation,
verify it, and only escalate to a human if the fix doesn't land. The part I
wanted to get right this week was making retries safe — if attempt #1 fails,
attempt #2 shouldn't be fighting attempt #1 for the same branch.

## The workflow

For each fix attempt, I create an isolated worktree keyed to the run:

```
npx @cobusgreyling/loop-worktree create --run-id pr-42-fix-1 --pattern pr-babysitter
```

That gives me a fresh checkout under `.loop-worktrees/pr-42-fix-1` on its own
branch (`loop/pr-42-fix-1`), tracked in `.loop-worktrees/manifest.json` — so
nothing touches the branch another attempt might still be using.

Once the verifier rejects an attempt, I mark it rather than deleting it
immediately — that keeps the audit trail intact:

```
npx @cobusgreyling/loop-worktree mark --run-id pr-42-fix-1 --status rejected
```

`list` gives me a quick read on what's currently tracked:

```
npx @cobusgreyling/loop-worktree list
```

And periodically I sweep anything rejected or escalated:

```
npx @cobusgreyling/loop-worktree cleanup --status rejected --older-than 24h
```

## Pairing with loop-context --check

Before letting the loop retry again, I run the ledger through
`loop-context --check` so a stuck fix doesn't just keep burning attempts:

```
npx @cobusgreyling/loop-context --check --ledger run.json --stagnation 3 --json
```

With three identical failures in a row it stayed green (`shouldContinue: true`),
but on the fourth repeat of the same error it correctly flipped to
`escalate: true` with exit code 2 — which is the signal I use to stop the loop
and hand the PR back to a human instead of trying a fifth time.

## The surprise

The gotcha that cost me the most time: `--check`'s stagnation trigger only
recognizes attempts with `"outcome": "failure"` exactly. I'd first logged
attempts as `"outcome": "fail"` — `--summary` and `--status` happily counted
those as failures and showed the repeated error, so everything *looked*
right, but `--check` never escalated no matter how many times the same error
repeated. Nothing errors out to tell you the value was wrong; the breaker
just quietly stays at "continue." Since the whole point of pairing
loop-worktree with loop-context is to stop a bad retry loop before it wastes
a worktree (and tokens) on a fix that isn't working, a silently-inert circuit
breaker is exactly the failure mode you don't want.

Separately, a smaller but good surprise: `cleanup --older-than 24h` refused
to remove a worktree I'd just marked rejected seconds earlier — it only acts
once the attempt is actually old enough (or you pass `--force`). That's the
right default; I just didn't expect it on first try and thought the command
had silently no-op'd.

## What I'd change

I'd want `--check` to validate the `outcome` field against the documented
enum and fail loudly (or at least warn) on an unrecognized value, instead of
silently treating it as a no-op for the stagnation/no-progress triggers while
`--summary` keeps counting it as a failure. Right now the two commands can
disagree about the same ledger without telling you.