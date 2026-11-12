/**
 * Capability checker for harness × pattern compatibility.
 *
 * Verifies that a pattern's required_capabilities are satisfied by a
 * harness's capabilities. Pure function with no side effects — accepts
 * Harness + PatternManifest, returns success or structured error.
 *
 * @see .scratch/generic-agent-harness/issues/03-capability-checker-with-fail-fast.md
 */
import type { Harness } from '../harness/types.js';
import type { PatternManifest } from '../pattern/loader.js';
/** Result of a capability check. */
export interface CapabilityCheckResult {
    /** Whether all required capabilities are satisfied. */
    satisfied: boolean;
    /** List of missing capability names (empty when satisfied). */
    missing: string[];
}
/** Options for checkCapabilities behavior. */
export interface CheckCapabilitiesOptions {
    /**
     * When true (default), throw a CapabilityError on failure.
     * When false, return the result object without throwing.
     */
    throw?: boolean;
}
/**
 * Structured error thrown when a harness lacks capabilities required by a pattern.
 * Contains machine-readable properties for programmatic handling.
 */
export declare class CapabilityError extends Error {
    /** The pattern that requires the missing capabilities. */
    patternId: string;
    /** The harness being checked. */
    harnessId: string;
    /** List of missing capability names. */
    missingCapabilities: string[];
    constructor(patternId: string, harnessId: string, missing: string[]);
}
/**
 * Check whether a harness satisfies all capabilities required by a pattern.
 *
 * Pure function: does not read or write files, does not modify inputs.
 *
 * @param harness - The harness manifest to check against.
 * @param pattern - The pattern manifest declaring required capabilities.
 * @param options - Optional behavior flags (default: throw on failure).
 * @returns A CapabilityCheckResult indicating satisfaction status and any gaps.
 * @throws CapabilityError when capabilities are insufficient and options.throw is true (default).
 */
export declare function checkCapabilities(harness: Harness, pattern: PatternManifest, options?: CheckCapabilitiesOptions): CapabilityCheckResult;
