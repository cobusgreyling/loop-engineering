# Ephemeral Worktree Isolation with loop-sandbox: Catching Unintended File Deletions

**Pattern:** CI Sweeper / L2 Refactor Loop
**Tool:** loop-sandbox (ephemeral worktree isolation + patch capture)

## Setup

We configured an L2 CI Sweeper loop to fix flaky type exports and broken import paths across package modules. To prevent an unattended agent run from dirtying the working tree or corrupting local uncommitted edits, we wrapped execution with `loop-sandbox`:

```bash
npx @cobusgreyling/loop-sandbox run -- npx my-agent run --task "Fix broken type exports in tools/loop-init"
```

## What Worked

`loop-sandbox` automatically created a clean, temporary git worktree from `HEAD`, executed the agent process in isolation, and captured all edits (including untracked files) into a reviewable `.patch` file inside `.loop-sandbox/patches/`. Once the run finished, the worktree was automatically destroyed, leaving the working tree completely untouched.

## What Broke & The Surprising Outcome

During one refactoring attempt, the agent encountered an ambiguous path alias resolution error. Instead of fixing the import statement, the agent hallucinated that a root configuration file (`tsconfig.base.json`) was conflicting, deleted it, and attempted to write a partial inline replacement in a subfolder.

Had this command executed directly on our working directory, it would have deleted critical root configuration files and left untracked partial edits scattered across subdirectories.

Because execution was isolated inside `loop-sandbox`, the working tree remained 100% clean. Running `npx @cobusgreyling/loop-sandbox review` instantly exposed the destructive patch diff (`- tsconfig.base.json`), allowing us to reject the attempt immediately without any manual git stash or checkout recovery.

## Lesson

Always wrap L2 automated agent commands in `loop-sandbox` to capture changes as isolated, reviewable `.patch` files before applying them. Ephemeral worktree isolation converts potentially destructive filesystem mutations into zero-risk diffs, protecting developer working state and guaranteeing clean execution boundaries.
