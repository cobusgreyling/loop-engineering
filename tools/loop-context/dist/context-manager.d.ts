/**
 * Stateful Memory Manager — Context Manager, Pruner, and Circuit Breaker.
 *
 * Sits between an agent loop and its durable memory (STATE.md, run logs).
 * Before each new iteration it can: summarize what has been tried, prune stale
 * or verbose context (long stack traces, repeated errors), and inject only the
 * essentials into the next prompt — keeping the context window clean and focused.
 *
 * The circuit breaker detects the two classic loop failures the docs warn about:
 *   - stagnant runs (retrying the same error N times)
 *   - no-progress loops (repeated failures with no success)
 * and, together with iteration and token caps, escalates to a human instead of
 * burning tokens in a hopeless loop.
 *
 * All logic here is deterministic and dependency-free — no LLM call is required
 * to summarize or prune, so it is cheap to run on every iteration and easy to test.
 */
export type Outcome = 'success' | 'failure' | 'noop';
export interface Attempt {
    /** 1-based iteration number within the run. */
    iteration: number;
    /** ISO timestamp of the attempt (optional). */
    timestamp?: string;
    /** What the agent tried this iteration (a short description). */
    action: string;
    /** Result of the attempt. */
    outcome: Outcome;
    /** Raw error message or stack trace, if the attempt failed. */
    error?: string;
    /** Tokens spent on this iteration, if tracked. */
    tokensUsed?: number;
    /** Set by the pruner when consecutive identical failures are collapsed. */
    repeated?: number;
}
export interface Ledger {
    /** The loop's original goal — the anchor the agent must not lose. */
    goal: string;
    /** ISO timestamp when the run started (optional). */
    startedAt?: string;
    /** Ordered list of attempts, oldest first. */
    attempts: Attempt[];
}
export interface CircuitBreakerConfig {
    /** Hard cap on total iterations before escalating. */
    maxIterations: number;
    /** Escalate when the same error signature repeats this many times in a row. */
    stagnationThreshold: number;
    /** Escalate after this many consecutive failures with no success in between. */
    noProgressThreshold: number;
    /** Optional hard cap on cumulative tokens across the run. */
    tokenBudget?: number;
}
export interface PruneConfig {
    /** Max lines to keep from any single stack trace. */
    maxTraceLines: number;
    /** Number of most-recent attempts to retain in the pruned ledger. */
    window: number;
}
export declare const DEFAULT_BREAKER: CircuitBreakerConfig;
export declare const DEFAULT_PRUNE: PruneConfig;
/**
 * Reduce a raw error / stack trace to a stable signature so that "the same
 * error" can be recognized across iterations even when volatile details
 * (line numbers, addresses, timestamps, ports, temp paths) differ.
 */
export declare function errorSignature(error: string): string;
export type BreakerTrigger = 'ok' | 'stagnation' | 'no-progress' | 'token-budget' | 'max-iterations';
export interface BreakerDecision {
    /** Whether the loop is cleared to run another iteration. */
    shouldContinue: boolean;
    /** Whether the loop must hand off to a human. */
    escalate: boolean;
    /** Which condition fired (or 'ok'). */
    trigger: BreakerTrigger;
    /** Human-readable explanation. */
    reason: string;
    iterations: number;
    tokensUsed: number;
}
/**
 * Decide whether the loop may continue. Checks the most specific and cheapest-
 * to-fix conditions first (stagnation, then no-progress) before the absolute
 * caps (token budget, iteration count), so the reported reason is the most
 * actionable one when several conditions hold.
 */
export declare function checkCircuitBreaker(ledger: Ledger, config?: CircuitBreakerConfig): BreakerDecision;
/** Truncate a stack trace to its most useful head, noting how much was dropped. */
export declare function pruneStackTrace(trace: string, maxLines: number): string;
/**
 * Produce a lean ledger for injection: keep only the most-recent `window`
 * attempts, prune verbose traces, and collapse consecutive identical failures
 * into a single entry with a repeat count. The full ledger is untouched — this
 * returns a new object.
 */
export declare function pruneLedger(ledger: Ledger, config?: PruneConfig): Ledger;
export interface ErrorGroup {
    signature: string;
    count: number;
    sample: string;
}
export interface AttemptSummary {
    totalAttempts: number;
    successes: number;
    failures: number;
    noops: number;
    tokensUsed: number;
    /** Distinct error signatures, most frequent first. */
    distinctErrors: ErrorGroup[];
    /** Unique actions the agent has already tried. */
    actionsTried: string[];
}
/** Deterministic factual rollup of the whole run — no LLM required. */
export declare function summarizeAttempts(ledger: Ledger): AttemptSummary;
/**
 * Build the compact context block to prepend to the next prompt. Contains only
 * what the agent needs to make progress: the goal, what has already been tried
 * (so it does not repeat itself), the last pruned error, and the breaker status.
 */
export declare function buildContextInjection(ledger: Ledger, breaker?: CircuitBreakerConfig, prune?: PruneConfig): string;
