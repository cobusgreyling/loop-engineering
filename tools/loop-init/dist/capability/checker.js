/**
 * Capability checker for harness × pattern compatibility.
 *
 * Verifies that a pattern's required_capabilities are satisfied by a
 * harness's capabilities. Pure function with no side effects — accepts
 * Harness + PatternManifest, returns success or structured error.
 *
 * @see .scratch/generic-agent-harness/issues/03-capability-checker-with-fail-fast.md
 */
/**
 * Structured error thrown when a harness lacks capabilities required by a pattern.
 * Contains machine-readable properties for programmatic handling.
 */
export class CapabilityError extends Error {
    /** The pattern that requires the missing capabilities. */
    patternId;
    /** The harness being checked. */
    harnessId;
    /** List of missing capability names. */
    missingCapabilities;
    constructor(patternId, harnessId, missing) {
        const capList = missing.join(', ');
        super(`Pattern "${patternId}" requires capabilities not supported by harness "${harnessId}": ${capList}`);
        this.name = 'CapabilityError';
        this.patternId = patternId;
        this.harnessId = harnessId;
        this.missingCapabilities = [...missing];
    }
}
/**
 * Resolve whether a single capability is satisfied by the harness.
 *
 * Boolean capabilities (shell, file_write, skill_read, worktree, sub_agent, mcp)
 * are satisfied when their value is `true`.
 *
 * The scheduling capability is satisfied when its value is NOT "none"
 * (i.e., "native" or "external" both satisfy).
 */
function isCapabilitySatisfied(capabilities, capabilityName) {
    if (capabilityName === 'scheduling') {
        return capabilities.scheduling !== 'none';
    }
    // All other known capabilities are boolean fields
    const value = capabilities[capabilityName];
    return value === true;
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
export function checkCapabilities(harness, pattern, options) {
    const shouldThrow = options?.throw ?? true;
    const missing = [];
    for (const cap of pattern.required_capabilities) {
        if (!isCapabilitySatisfied(harness.capabilities, cap)) {
            missing.push(cap);
        }
    }
    const result = {
        satisfied: missing.length === 0,
        missing,
    };
    if (!result.satisfied && shouldThrow) {
        throw new CapabilityError(pattern.id, harness.id, missing);
    }
    return result;
}
