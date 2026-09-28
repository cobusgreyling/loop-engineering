/**
 * Proof that guardrails fire, read from the record `loop-drill --record` writes.
 *
 * Every other signal in the audit asks whether a file exists. That is how a
 * repo of empty files used to score 100/L3. loop-drill runs each guardrail
 * against a seeded fault and a benign case; this module reads what it found,
 * so the audit can tell a guardrail that works from one that is only present.
 *
 * A guardrail's results only count while they still describe the repo:
 *
 *   gate      the record's sha256 of gate.yaml must match the current file.
 *             Gate drills are deterministic, so they never expire otherwise.
 *   breaker   drills loop-context's defaults, which the repo does not edit.
 *   others    (verifier, injection, ...) run real commands against code that
 *             keeps changing, so they expire after PROOF_MAX_AGE_MS.
 */
export declare const PROOF_FILE = "loop-drill.json";
export declare const PROOF_SCHEMA = 1;
/** Canary results (verifier, injection) older than this no longer count. */
export declare const PROOF_MAX_AGE_MS: number;
type Outcome = 'passed' | 'failed' | 'skipped';
type Direction = 'sensitivity' | 'specificity';
export interface RecordedResult {
    id: string;
    direction: Direction;
    outcome: Outcome;
    detail?: string;
}
export interface RecordedGuardrail {
    recordedAt: string;
    /** What was drilled: for the gate, the policy file and its fingerprint. */
    input?: {
        file?: string;
        sha256?: string | null;
        command?: string;
    };
    results: RecordedResult[];
}
export interface DrillRecord {
    schema: number;
    guardrails: Record<string, RecordedGuardrail>;
}
export interface ProofSignals {
    /** loop-drill.json exists at the root. */
    present: boolean;
    /** Why the record could not be used, when present but unreadable. */
    error?: string;
    /** Current, no failures, and a passing drill in both directions. */
    proven: string[];
    /** Current, and at least one drill failed: the guardrail did not fire. */
    failed: string[];
    /** Current, but every drill was skipped, so nothing was tested. */
    untested: string[];
    /** Recorded against a different gate.yaml, or too long ago to count. */
    stale: string[];
    /** Ids of failed drills, for the report. */
    failures: string[];
    /** Skip reasons for untested guardrails, for the report. */
    skipReasons: Record<string, string>;
}
/**
 * sha256 of a policy file with line endings normalised, so a checkout with
 * core.autocrlf fingerprints the same as the Linux runner that recorded it.
 * loop-drill computes the same value; both test suites pin the same vector.
 */
export declare function fingerprint(text: string): string;
/** Validate the parsed record. Returns an error message, or null when usable. */
export declare function validateRecord(value: unknown): string | null;
export declare function readProof(root: string, now?: number): Promise<ProofSignals>;
export {};
