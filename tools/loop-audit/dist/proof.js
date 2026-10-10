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
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from '@cobusgreyling/readiness-core';
export const PROOF_FILE = 'loop-drill.json';
export const PROOF_SCHEMA = 1;
/** Canary results (verifier, injection) older than this no longer count. */
export const PROOF_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Guardrails whose results depend only on their recorded input, not on time. */
const TIMELESS = new Set(['gate', 'breaker']);
/**
 * sha256 of a policy file with line endings normalised, so a checkout with
 * core.autocrlf fingerprints the same as the Linux runner that recorded it.
 * loop-drill computes the same value; both test suites pin the same vector.
 */
export function fingerprint(text) {
    return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}
function emptyProof(present, error) {
    return { present, error, proven: [], failed: [], untested: [], stale: [], failures: [], skipReasons: {} };
}
const OUTCOMES = new Set(['passed', 'failed', 'skipped']);
const DIRECTIONS = new Set(['sensitivity', 'specificity']);
function isResult(value) {
    const r = value;
    return (!!r &&
        typeof r.id === 'string' &&
        OUTCOMES.has(r.outcome) &&
        DIRECTIONS.has(r.direction) &&
        (r.detail === undefined || typeof r.detail === 'string'));
}
/** Validate the parsed record. Returns an error message, or null when usable. */
export function validateRecord(value) {
    const record = value;
    if (!record || typeof record !== 'object')
        return 'expected a JSON object';
    if (record.schema !== PROOF_SCHEMA)
        return `unsupported schema ${String(record.schema)} (expected ${PROOF_SCHEMA})`;
    if (!record.guardrails || typeof record.guardrails !== 'object')
        return 'missing "guardrails"';
    for (const [name, g] of Object.entries(record.guardrails)) {
        if (!g || typeof g.recordedAt !== 'string' || Number.isNaN(new Date(g.recordedAt).getTime())) {
            return `guardrail "${name}" has no valid recordedAt`;
        }
        if (!Array.isArray(g.results) || !g.results.every(isResult)) {
            return `guardrail "${name}" has malformed results`;
        }
    }
    return null;
}
async function currentGateFingerprint(root) {
    const p = path.join(root, 'gate.yaml');
    if (!(await fileExists(p)))
        return null;
    try {
        return fingerprint(await readFile(p, 'utf8'));
    }
    catch {
        return null;
    }
}
/** Does this guardrail's record still describe the repo as it is now? */
function isCurrent(name, g, gateSha, now) {
    if (name === 'gate') {
        return g.input?.file === 'gate.yaml' && !!g.input.sha256 && g.input.sha256 === gateSha;
    }
    if (TIMELESS.has(name))
        return true;
    const age = now - new Date(g.recordedAt).getTime();
    return age <= PROOF_MAX_AGE_MS && age >= -60_000;
}
/**
 * Proven means the guardrail caught a seeded fault *and* let a benign case
 * through, with nothing failing. One direction is easy to fake: a denylist of
 * "**" catches every fault, and a verifier that rejects everything catches
 * every mutant. loop-drill always drills both; this insists on both.
 */
function classify(results) {
    if (results.some((r) => r.outcome === 'failed'))
        return 'failed';
    const passed = results.filter((r) => r.outcome === 'passed');
    const both = passed.some((r) => r.direction === 'sensitivity') && passed.some((r) => r.direction === 'specificity');
    return both ? 'proven' : 'untested';
}
export async function readProof(root, now = Date.now()) {
    const p = path.join(root, PROOF_FILE);
    if (!(await fileExists(p)))
        return emptyProof(false);
    let parsed;
    try {
        parsed = JSON.parse(await readFile(p, 'utf8'));
    }
    catch (err) {
        return emptyProof(true, `not valid JSON (${err.message})`);
    }
    const error = validateRecord(parsed);
    if (error)
        return emptyProof(true, error);
    const record = parsed;
    const gateSha = await currentGateFingerprint(root);
    const proof = emptyProof(true);
    for (const [name, g] of Object.entries(record.guardrails).sort(([a], [b]) => a.localeCompare(b))) {
        if (!isCurrent(name, g, gateSha, now)) {
            proof.stale.push(name);
            continue;
        }
        const verdict = classify(g.results);
        proof[verdict].push(name);
        if (verdict === 'failed') {
            proof.failures.push(...g.results.filter((r) => r.outcome === 'failed').map((r) => r.id));
        }
        if (verdict === 'untested') {
            const reason = g.results.find((r) => r.outcome === 'skipped' && r.detail)?.detail;
            if (reason)
                proof.skipReasons[name] = reason;
        }
    }
    return proof;
}
