/**
 * Strip credentials from anything that might be sent to TypeSafe or printed.
 * The API key itself must never appear in state, logs, or CLI output.
 */
export declare const REDACTED = "[REDACTED]";
export declare function redactString(value: string): string;
export declare function redactSecrets(value: unknown): unknown;
/** True if `haystack` still contains a secret-shaped value after redaction should have run. */
export declare function containsSecret(haystack: string): boolean;
