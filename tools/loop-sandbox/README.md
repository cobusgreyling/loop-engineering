# loop-sandbox

Ephemeral worktree isolation for Loop Engineering. Divert agent execution into an isolated git worktree, capture their changes as a reviewable `.patch` file, and instantly destroy the sandbox.

## Why loop-sandbox?

Unattended AI agents (loops) running directly in your main working tree can cause damage, overwrite untracked files, or make it incredibly tedious to untangle failed execution attempts.

`loop-sandbox` solves this by providing **ephemeral worktree isolation**:
1. It automatically creates an isolated git worktree for the agent to run in.
2. The agent runs its command, interacting with the codebase completely naturally.
3. When the command finishes, `loop-sandbox` automatically captures the agent's edits (including new untracked files) into a clean `.patch` file.
4. It nukes the worktree, keeping your main repo completely clean.

A human can then safely review the patch and apply it with one keystroke.

> [!WARNING]
> **Isolation Limits:** This is not a containerized air-gap. The agent process retains full filesystem and network access. It can escape the worktree (e.g. `../../`), and changes outside the worktree or to `.gitignored` files will **not** be captured in the patch. This tool is complementary to [docs/safety.md](../../docs/safety.md) and does not replace OS-level sandboxing for hostile code.

## Installation

```bash
npm install -g @cobusgreyling/loop-sandbox
# or run directly via npx
npx @cobusgreyling/loop-sandbox run -- <command>
```

> [!IMPORTANT]
> **Required Gitignores:** You must add the following to your project's `.gitignore` to prevent patches and worktree manifests from being committed:
> ```
> .loop-sandbox/
> .loop-worktrees/
> ```

## Usage

```bash
loop-sandbox <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `run [opts] -- <cmd>` | Run an agent command inside the isolated sandbox |
| `review` / `list` | List isolated patches ready for human review |

### Options for `run`

| Option | Description |
|--------|-------------|
| `--shell` | Forces `shell: true` (for `bash -c`, etc.). On Windows, npm-installed `.cmd` shims (`npx`, `tsc`, ...) that fail with `ENOENT` are automatically retried through a shell, so this is rarely needed there. |
| `--base <branch>` | The base branch for the worktree (defaults to current HEAD) |
| `--lock-paths <globs>` | Comma-separated globs to hold a [`loop-worktree`](../loop-worktree) advisory lock on for the run's duration, so a scheduled loop can't touch the same paths concurrently. Off by default -- see [Multi-loop safety](#multi-loop-safety) below. |
| `--lock-owner <name>` | Lock owner name (defaults to the run's generated id) |
| `--lock-ttl <dur>` | e.g. `30m` -- passed through to `loop-worktree`'s `--ttl` |
| `--lock-wait <dur>` | e.g. `5m` -- passed through to `loop-worktree`'s `--wait` |

### Examples

**Running a tool via an agent:**
```bash
# Safely let an agent run your linter/formatter without polluting your working tree
npx @cobusgreyling/loop-sandbox run -- npx my-agent
```

**Running a shell command:**
```bash
npx @cobusgreyling/loop-sandbox run --shell -- bash -c "echo 'hello' > test.txt"
```

**Running alongside a scheduled loop that touches the same files:**
```bash
npx @cobusgreyling/loop-sandbox run --lock-paths "src/**,docs/**" -- npx my-agent
```

**Reviewing and applying patches:**
```bash
# List all patches the sandbox caught
npx @cobusgreyling/loop-sandbox review

# Example output:
# === Loop Sandbox Patches ===
# 📄 sandbox-82f1e394.patch (1.2 KB)
#    Apply: git apply .loop-sandbox/patches/sandbox-82f1e394.patch
```

## How it works

Under the hood, `loop-sandbox` leverages `@cobusgreyling/loop-worktree` and native `git worktree` primitives. It creates a temporary branch from your current HEAD, spawns your process with its `cwd` set to the isolated tree, runs `git diff --cached` to generate the patch, and uses `git worktree remove --force` to clean up.

The patch compares the final staged tree against the sandbox's initial commit,
so it includes committed changes as well as staged, unstaged, and new untracked
files. Commits made by the agent are captured as net file changes, not preserved
as commit history. With `--base`, the initial commit is taken from that base.

## Multi-loop safety

A sandbox run is not, by itself, protected against a scheduled loop editing
the same files at the same time -- `--lock-paths` opts a run into
`loop-worktree`'s advisory lock (acquired before the worktree is created,
released once the run finishes) so a colliding scheduled loop's own `lock`
call fails loudly instead of racing silently. See
[docs/multi-loop.md](../../docs/multi-loop.md) for the wider convention this
follows.
