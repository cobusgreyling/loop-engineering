/**
 * loop-drill — fire drills for loop guardrails.
 *
 * docs/failure-modes.md names the ways loops fail. Some have mechanical
 * counterparts (loop-gate, loop-context's circuit breaker); loop-audit scores
 * whether those counterparts are *present*. Nothing checked whether they
 * actually fire.
 *
 * A drill injects a known fault and asserts the guardrail responds. Every
 * drill carries the failure mode it exercises, so the report reads as coverage
 * of docs/failure-modes.md rather than a list of anonymous assertions.
 *
 * Each guardrail gets both directions, because only one of them is easy:
 *   - sensitivity: the fault is caught (a guardrail that never fires is theater)
 *   - specificity: benign input is NOT caught (a guardrail that blocks
 *     everything passes every sensitivity drill while being useless)
 * A guardrail is only credited when it passes both.
 */
import { type GateConfig } from '@cobusgreyling/loop-gate';
import { type CircuitBreakerConfig } from '@cobusgreyling/loop-context';
export type DrillOutcome = 'passed' | 'failed' | 'skipped';
/** Named failure modes from docs/failure-modes.md. */
export type FailureMode = 'Infinite Fix Loop' | 'Token Burn' | 'Over-Reach (Wrong Scope)' | 'Verifier Theater' | 'Escalation Failure' | 'Prompt Injection via Untrusted Input';
export interface DrillResult {
    /** Stable id, e.g. 'gate.denylist'. */
    id: string;
    name: string;
    /** The docs/failure-modes.md entry this drill exercises. */
    failureMode: FailureMode;
    /** 'sensitivity' = fault must be caught; 'specificity' = benign must pass. */
    direction: 'sensitivity' | 'specificity';
    outcome: DrillOutcome;
    expected: string;
    actual: string;
    /** Why a drill was skipped, or extra context on a failure. */
    detail?: string;
}
export interface DrillReport {
    results: DrillResult[];
    passed: number;
    failed: number;
    skipped: number;
    /** Failure modes with at least one passing drill and no failing drill. */
    covered: FailureMode[];
    /** Failure modes with no passing drill (unexercised or broken). */
    uncovered: FailureMode[];
    timestamp: string;
}
export declare function skip(id: string, name: string, failureMode: FailureMode, direction: DrillResult['direction'], detail: string): DrillResult;
/**
 * Turn a denylist glob into a concrete path that should match it, so the drill
 * exercises the real matcher rather than re-implementing glob semantics.
 *
 * Deliberately conservative: `**` becomes a fixed segment, `*` becomes a
 * literal, and the caller verifies the synthesized path actually matches
 * before asserting anything about it (see runGateDrills) — a glob we
 * synthesize badly is reported as skipped, never as a guardrail failure.
 */
export declare function samplePathFor(glob: string): string;
export interface GateDrillOptions {
    config: GateConfig;
    /** Path assumed benign for the specificity drill. */
    benignPath?: string;
}
/**
 * Exercise loop-gate against its own gate.yaml: every denylist entry must
 * block, the file-count cap must block, auto-merge must reject a
 * non-allowlisted path, and an ordinary doc change must still be allowed.
 */
export declare function runGateDrills(options: GateDrillOptions): DrillResult[];
/**
 * Exercise loop-context's circuit breaker with synthetic ledgers: repeated
 * identical failures must trip stagnation, a long run of unrelated failures
 * must trip no-progress, blowing the token budget must trip, and a healthy run
 * must not.
 *
 * Each drill asserts the *specific* trigger, not merely that the breaker
 * escalated. Escalating for another reason means the rule under test is still
 * unproven — the same standard the gate drills apply to `trigger !==
 * 'denylist'`.
 */
export declare function runBreakerDrills(config?: CircuitBreakerConfig): DrillResult[];
export declare function buildReport(results: DrillResult[]): DrillReport;
/**
 * 0 = every drill passed, 1 = some skipped (guardrail not configured),
 * 2 = a guardrail failed to fire. Mirrors loop-gate / loop-context's
 * "2 means escalate" convention so control scripts can chain all three.
 */
export declare function exitCodeFor(report: DrillReport): 0 | 1 | 2;
