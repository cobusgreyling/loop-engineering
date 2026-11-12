/**
 * Pattern manifest schema and loader.
 *
 * Pattern manifests live at `starters/<pattern>/manifest.yaml` and declare
 * the capabilities a harness must support for the pattern to function.
 */

import { readFile } from 'node:fs/promises';
import * as yaml from 'js-yaml';

/** Known capability names from the spec minimum viable contract + extensions. */
const KNOWN_CAPABILITIES = new Set([
  'shell',
  'file_write',
  'skill_read',
  'worktree',
  'sub_agent',
  'scheduling',
  'mcp',
]);

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
export class ManifestError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ManifestError';
    this.code = code;
  }
}

/**
 * Validate a parsed manifest object against the schema.
 * Returns a structured result with errors and warnings.
 */
export function validatePatternManifest(raw: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // id is required and must be a non-empty string
  if (!raw.id || typeof raw.id !== 'string' || raw.id.trim() === '') {
    errors.push('Missing or invalid required field: id (must be a non-empty string)');
  }

  // required_capabilities is required and must be a non-empty array of strings
  if (!raw.required_capabilities) {
    errors.push('Missing required field: required_capabilities');
  } else if (!Array.isArray(raw.required_capabilities)) {
    errors.push('Invalid required_capabilities: must be an array');
  } else if (raw.required_capabilities.length === 0) {
    errors.push('Invalid required_capabilities: must not be empty');
  } else {
    for (let i = 0; i < raw.required_capabilities.length; i++) {
      const cap = raw.required_capabilities[i];
      if (typeof cap !== 'string') {
        errors.push(`Invalid required_capabilities[${i}]: must be a string, got ${typeof cap}`);
      } else if (!KNOWN_CAPABILITIES.has(cap)) {
        warnings.push(`Unknown capability name: "${cap}" — known capabilities are: ${[...KNOWN_CAPABILITIES].join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load and validate a pattern manifest from a YAML file path.
 * Throws ManifestError on parse failures or schema violations.
 * Unknown capability names produce console.warn but do not reject.
 */
export async function loadPatternManifest(filePath: string): Promise<PatternManifest> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ManifestError(
      `Failed to read manifest file: ${filePath} — ${(err as Error).message}`,
      'MANIFEST_READ_ERROR'
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    throw new ManifestError(
      `Failed to parse YAML in ${filePath}: ${(err as Error).message}`,
      'MANIFEST_PARSE_ERROR'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ManifestError(
      `Invalid manifest structure in ${filePath}: expected a YAML mapping`,
      'INVALID_MANIFEST'
    );
  }

  const raw = parsed as Record<string, unknown>;
  const validation = validatePatternManifest(raw);

  if (!validation.valid) {
    throw new ManifestError(
      `Invalid pattern manifest in ${filePath}: ${validation.errors.join('; ')}`,
      'INVALID_MANIFEST'
    );
  }

  // Emit warnings for unknown capabilities
  for (const warning of validation.warnings) {
    console.warn(`[pattern-manifest] ${warning}`);
  }

  return {
    id: raw.id as string,
    required_capabilities: raw.required_capabilities as string[],
    description: raw.description as string | undefined,
    version: raw.version as string | undefined,
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
  };
}
