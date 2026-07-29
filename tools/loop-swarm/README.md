# loop-swarm

Multi-agent consensus sandboxing for extreme high-confidence loop operations.

`loop-swarm` runs an agent command multiple times sequentially in separate, isolated `loop-sandbox` worktrees. It then extracts the resulting `.patch` files from each run, hashes them, and automatically determines if a majority consensus was reached.

If an agent produces non-deterministic results, `loop-swarm` acts as an L3 safety net by ensuring that only changes verified by multiple sequential agent runs are proposed.

> [!IMPORTANT]
> This tool implements an **ephemeral git worktree isolation** safety boundary. It is NOT an OS-level sandbox or container. For full details on the threat model, please read [Safety Boundaries](../../docs/safety.md).

## Usage

```bash
npx @cobusgreyling/loop-swarm run --count 3 -- npx my-agent run --task "Refactor utils.ts"
```

See [Quickstart](../../docs/QUICKSTART.md#multi-agent-consensus-sandboxing-loop-swarm) for workflow examples and command patterns.

## How it works

1. Spawns `N` (default: 3) instances of `loop-sandbox` sequentially (to prevent git worktree and signal handler races).
2. Waits for all sandboxes to finish executing the agent and extract their diffs. Any agent that fails (non-zero exit code) is disqualified from voting.
3. Hashes the raw byte contents of each `.patch` file.
4. If a strict majority (`Math.floor(N / 2) + 1` of the total launched agents) produce the exact same byte-for-byte patch, it copies the winning patch to `.loop-sandbox/patches/consensus.patch`.
5. Cleans up all the ephemeral worktrees.

## Exit Codes & Behavior

- **`0`**: Consensus reached successfully (either on a specific patch, or on "no changes needed" if the majority of agents succeeded without producing a patch).
- **`1`**: Failure to reach consensus, or internal tool failure.

## Limitations

- **Byte-Identical Consensus**: Consensus relies on exact `SHA-256` hashing of the patch bytes. If two agents arrive at semantically identical code but with different whitespace or comment ordering, `loop-swarm` will consider them divergent.
- **Shared Stdio**: The sequential agents share the parent process's standard IO. 
- **Time Penalty**: Because execution is currently serialized to maintain safety guarantees on the manifest, running an agent with `--count 3` will take roughly 3x as long as running it once.
- **SIGINT Handling**: Because `loop-sandbox` runs in-process, its signal handler will exit the entire process on `SIGINT`. A signal during an agent run exits the entire swarm rather than allowing swarm-owned cleanup. This is a v1 limitation until subprocessing is implemented.
