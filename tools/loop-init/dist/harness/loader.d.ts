/**
 * Harness manifest loader.
 *
 * Parses YAML manifest files from `harnesses/<id>.yaml` into typed
 * Harness objects with validation. Supports alias resolution for
 * backward-compatible --tool values.
 */
import type { Harness } from './types.js';
/** Structured error for harness loading failures. */
export declare class HarnessLoadError extends Error {
    readonly harnessId: string;
    constructor(harnessId: string, reason: string);
}
/**
 * Load a harness manifest by its canonical ID.
 *
 * @param id - The harness identifier (must match a file at harnesses/<id>.yaml)
 * @returns Parsed and validated Harness object
 * @throws HarnessLoadError if the manifest is missing or invalid
 */
export declare function loadHarness(id: string): Promise<Harness>;
/**
 * Resolve a tool value (which may be an alias) to a canonical harness ID.
 *
 * @param toolValue - The --tool flag value or alias
 * @returns The canonical harness ID
 * @throws HarnessLoadError if no harness matches the given value
 */
export declare function resolveHarnessId(toolValue: string): Promise<string>;
/**
 * List all available harness manifests.
 *
 * @returns Array of parsed Harness objects for every valid manifest in harnesses/
 */
export declare function listHarnesses(): Promise<Harness[]>;
