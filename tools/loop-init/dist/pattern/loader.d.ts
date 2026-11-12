/**
 * Pattern manifest schema and loader.
 *
 * Pattern manifests live at `starters/<pattern>/manifest.yaml` and declare
 * the capabilities a harness must support for the pattern to function.
 */
/** Typed pattern manifest object. */
export interface PatternManifest {
    /** Manifest key, matches the parent directory name under starters/. */
    id: string;
    /** Capabilities the harness must support for this pattern to function. */
    required_capabilities: string[];
    /** Optional human-readable description. */
    description?: string;
    /** Optional schema version for future evolution. */
    version?: string;
    /** Warnings emitted during loading (e.g., unknown capability names). */
    warnings?: string[];
}
/** Validation result for programmatic checking. */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/** Error with a machine-readable code for structured handling. */
export declare class ManifestError extends Error {
    code: string;
    constructor(message: string, code: string);
}
/**
 * Validate a parsed manifest object against the schema.
 * Returns a structured result with errors and warnings.
 */
export declare function validatePatternManifest(raw: Record<string, unknown>): ValidationResult;
/**
 * Load and validate a pattern manifest from a YAML file path.
 * Throws ManifestError on parse failures or schema violations.
 * Unknown capability names produce console.warn but do not reject.
 */
export declare function loadPatternManifest(filePath: string): Promise<PatternManifest>;
