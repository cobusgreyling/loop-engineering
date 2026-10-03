/**
 * The verifier canary — the drill that gave this package its reason to exist.
 *
 * loop-audit awards its joint-largest signal (14 points) for a verifier, and
 * gates L3 on it, by checking whether a file whose name contains "verifier"
 * exists. An empty file passes. docs/failure-modes.md calls the resulting
 * failure "Verifier Theater" and rates it S2; docs/primitives.md calls
 * maker/checker "the single most important structural pattern for reliable
 * loops". Nothing tested whether the verifier verifies.
 *
 * This runs the real verifier command against real seeded defects in an
 * isolated worktree, and scores it on what it caught:
 *
 *   control  — clean tree      -> the verifier must ACCEPT (exit 0)
 *   mutants  — one seeded bug  -> the verifier must REJECT (non-zero exit)
 *
 * Both directions are required. A verifier that rejects everything catches
 * every mutant while being worthless, and the control run is what exposes it.
 */
import { type Mutant } from './mutations.js';
import { type DrillResult } from './drill.js';
export interface CanaryOptions {
    /** Repo root to drill. */
    root: string;
    /** The verifier command. Non-zero exit is read as "rejected". */
    command: string;
    /** How many mutants to seed. More is slower but a sharper score. */
    count: number;
    /** Per-run timeout in ms. A verifier that hangs is a failed verifier. */
    timeoutMs: number;
    /** Restrict mutation to files under this repo-relative path. */
    scope?: string;
    /** Command run inside each worktree before verifying (e.g. "npm ci"). */
    setup?: string;
}
export interface VerifierRun {
    accepted: boolean;
    exitCode: number | null;
    timedOut: boolean;
    output: string;
}
/**
 * Run the verifier in `cwd`. Exit 0 means "accepted this change"; anything
 * else — including a timeout — means "rejected". A verifier that cannot be
 * launched at all is a distinct failure, surfaced by the caller.
 */
export declare function runVerifier(command: string, cwd: string, timeoutMs: number): Promise<VerifierRun>;
/** Files git tracks, filtered to plausible mutation targets. */
export declare function candidateFiles(root: string, scope?: string): Promise<string[]>;
/**
 * Build up to `count` mutants from distinct files. Distinct files matter:
 * seeding three mutants into one module mostly measures whether the verifier
 * reads that module.
 */
export declare function collectMutants(root: string, files: string[], count: number): Promise<Mutant[]>;
/**
 * Run the verifier inside an ephemeral git worktree, so a verifier that writes,
 * builds, or fixes cannot touch the real checkout. `mutant` is null for the
 * worktree control run. The worktree is always removed, including on throw.
 */
/**
 * Run `fn` inside an ephemeral git worktree of `root`, so whatever it runs
 * cannot touch the real checkout. The worktree is always removed, including
 * when `fn` throws. Shared by the verifier canary and the injection canary.
 */
export declare function withWorktree<T>(root: string, fn: (worktree: string) => Promise<T>): Promise<T>;
/** Run `setup` (if any) in `worktree`. Returns a failed run, or null on success. */
export declare function prepareWorktree(worktree: string, timeoutMs: number, setup?: string): Promise<VerifierRun | null>;
export interface CanaryReport {
    results: DrillResult[];
    /** Mutants rejected / mutants run. Null when no mutant could be built. */
    mutationScore: number | null;
    caught: number;
    escaped: number;
}
export declare function runCanary(options: CanaryOptions): Promise<CanaryReport>;
