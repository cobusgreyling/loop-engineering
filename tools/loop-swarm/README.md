# loop-swarm

Multi-agent consensus sandboxing for extreme high-confidence loop operations.

`loop-swarm` runs an agent command multiple times concurrently in separate, isolated `loop-sandbox` worktrees. It then extracts the resulting `.patch` files from each run, hashes them, and automatically determines if a majority consensus was reached.

If an agent produces non-deterministic results, `loop-swarm` acts as an L3 safety net by ensuring that only changes verified by multiple parallel agent runs are proposed.

## Usage

```bash
npx @cobusgreyling/loop-swarm run --count 3 -- npx my-agent run --task "Refactor utils.ts"
```

## How it works

1. Spawns `N` (default: 3) parallel instances of `loop-sandbox`.
2. Waits for all sandboxes to finish executing the agent and extract their diffs.
3. Hashes the raw byte contents of each `.patch` file.
4. If a strict majority (e.g., 2 out of 3) produce the exact same byte-for-byte patch, it copies the winning patch to `.loop-sandbox/patches/consensus.patch`.
5. Cleans up all the ephemeral worktrees.
