/**
 * `loop-drill --record`: write what the drills found to loop-drill.json, so
 * loop-audit can score guardrails that were shown to fire rather than files
 * that merely exist.
 *
 * The record is grouped by guardrail (gate, breaker, verifier, ...). Recording
 * a subset -- say `--only verifier` -- replaces that group and keeps the rest,
 * so a slow canary run does not have to be repeated to refresh the gate.
 *
 * Each group carries what it was drilled against. For the gate that is a
 * fingerprint of the policy file: edit gate.yaml and the old proof stops
 * counting until the drills are run again.
 */
import type { DrillResult } from './drill.js';
export declare const RECORD_FILE = "loop-drill.json";
export declare const RECORD_SCHEMA = 1;
export interface RecordedResult {
    id: string;
    failureMode: string;
    direction: DrillResult['direction'];
    outcome: DrillResult['outcome'];
    /** Only kept for drills that did not pass, to say why. */
    detail?: string;
}
export interface RecordedGuardrail {
    recordedAt: string;
    input?: {
        file?: string;
        sha256?: string | null;
        command?: string;
    };
    mutationScore?: number | null;
    results: RecordedResult[];
}
export interface DrillRecord {
    schema: number;
    tool: string;
    guardrails: Record<string, RecordedGuardrail>;
}
/**
 * sha256 of a policy file with line endings normalised, so a Windows checkout
 * with core.autocrlf fingerprints the same as the Linux runner that recorded
 * it. loop-audit computes the same value; both test suites pin one vector.
 */
export declare function fingerprint(text: string): string;
/** 'gate.denylist[**\/.env]' -> 'gate'; a whole-drill skip like 'verifier' -> 'verifier'. */
export declare function guardrailOf(id: string): string;
export interface GroupInputs {
    recordedAt: string;
    /** Repo-relative, forward slashes. */
    gateFile?: string;
    gateSha256?: string | null;
    verifierCommand?: string;
    mutationScore?: number | null;
}
/** Group this run's results by the guardrails that were selected. */
export declare function buildGroups(results: DrillResult[], selected: Iterable<string>, inputs: GroupInputs): Record<string, RecordedGuardrail>;
/** Replace the groups this run drilled; keep the others from the existing record. */
export declare function mergeRecord(existing: unknown, groups: Record<string, RecordedGuardrail>): DrillRecord;
export declare function writeRecord(root: string, groups: Record<string, RecordedGuardrail>): Promise<string>;
