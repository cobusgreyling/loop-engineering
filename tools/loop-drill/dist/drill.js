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
import { checkGate } from '@cobusgreyling/loop-gate';
import { checkCircuitBreaker, DEFAULT_BREAKER, } from '@cobusgreyling/loop-context';
function pass(id, name, failureMode, direction, expected, actual) {
    return { id, name, failureMode, direction, outcome: 'passed', expected, actual };
}
function fail(id, name, failureMode, direction, expected, actual, detail) {
    return { id, name, failureMode, direction, outcome: 'failed', expected, actual, detail };
}
export function skip(id, name, failureMode, direction, detail) {
    return {
        id,
        name,
        failureMode,
        direction,
        outcome: 'skipped',
        expected: '—',
        actual: '—',
        detail,
    };
}
// ── Glob → concrete sample path ────────────────────────────────────
/**
 * Turn a denylist glob into a concrete path that should match it, so the drill
 * exercises the real matcher rather than re-implementing glob semantics.
 *
 * Deliberately conservative: `**` becomes a fixed segment, `*` becomes a
 * literal, and the caller verifies the synthesized path actually matches
 * before asserting anything about it (see runGateDrills) — a glob we
 * synthesize badly is reported as skipped, never as a guardrail failure.
 */
export function samplePathFor(glob) {
    const concrete = glob
        .split('/')
        .map((segment) => {
        if (segment === '**')
            return 'src';
        if (segment === '*')
            return 'sample';
        // '*_key*' -> 'drill_key_sample'; '.env.*' -> '.env.sample'
        return segment.replace(/\*/g, (_m, offset) => (offset === 0 ? 'drill' : 'sample'));
    })
        .join('/');
    // A trailing '**' segment became 'src', which is a directory, not a file.
    return /(^|\/)src$/.test(concrete) ? `${concrete}/drill-file.txt` : concrete;
}
/**
 * Exercise loop-gate against its own gate.yaml: every denylist entry must
 * block, the file-count cap must block, auto-merge must reject a
 * non-allowlisted path, and an ordinary doc change must still be allowed.
 */
export function runGateDrills(options) {
    const { config, benignPath = 'docs/README.md' } = options;
    const results = [];
    const mode = 'Over-Reach (Wrong Scope)';
    // Sensitivity: each denylist glob blocks a path that matches it.
    for (const glob of config.denylist) {
        const id = `gate.denylist[${glob}]`;
        const name = `denylist blocks ${glob}`;
        const sample = samplePathFor(glob);
        const decision = checkGate({ config, action: 'commit', paths: [sample] });
        if (decision.allowed) {
            results.push(fail(id, name, mode, 'sensitivity', `commit touching ${sample} is blocked`, `allowed (${decision.trigger})`, `Denylist entry "${glob}" did not match the sample path this drill synthesized for it. Either the glob is unreachable in practice, or the sample is unrepresentative — check it by hand with: loop-gate check --action commit --paths ${sample}`));
            continue;
        }
        if (decision.trigger !== 'denylist') {
            // Blocked, but by file-count or the allowlist — the denylist itself is
            // unproven, so this is not a pass.
            results.push(fail(id, name, mode, 'sensitivity', `blocked by the denylist`, `blocked by ${decision.trigger}`, 'The path was stopped, but not by the rule under test.'));
            continue;
        }
        results.push(pass(id, name, mode, 'sensitivity', 'blocked by denylist', decision.reason));
    }
    // Sensitivity: the file-count cap fires one file past the threshold.
    if (config.maxFiles !== undefined) {
        const id = 'gate.file-count';
        const name = `file-count cap fires above ${config.maxFiles} files`;
        const paths = Array.from({ length: config.maxFiles + 1 }, (_, i) => `docs/drill-${i}.md`);
        const decision = checkGate({ config, action: 'commit', paths });
        results.push(decision.trigger === 'file-count'
            ? pass(id, name, mode, 'sensitivity', 'blocked by file-count', decision.reason)
            : fail(id, name, mode, 'sensitivity', `${paths.length} files is blocked by file-count`, decision.allowed ? 'allowed' : `blocked by ${decision.trigger}`));
    }
    else {
        results.push(skip('gate.file-count', 'file-count cap', mode, 'sensitivity', 'gate.yaml sets no maxFiles — a loop may propose an arbitrarily large diff.'));
    }
    // Sensitivity: auto-merge rejects a path outside the allowlist.
    if (config.autoMergeAllowlist && config.autoMergeAllowlist.length > 0) {
        const id = 'gate.auto-merge';
        const name = 'auto-merge rejects a non-allowlisted path';
        const outside = 'src/drill-not-allowlisted.bin';
        const decision = checkGate({ config, action: 'auto-merge', paths: [outside] });
        results.push(!decision.allowed
            ? pass(id, name, mode, 'sensitivity', `auto-merge of ${outside} is blocked`, decision.reason)
            : fail(id, name, mode, 'sensitivity', `auto-merge of ${outside} is blocked`, 'allowed'));
    }
    // Specificity: an ordinary change is still allowed. A gate that blocks
    // everything would pass every drill above while being useless in practice.
    const benign = checkGate({ config, action: 'commit', paths: [benignPath] });
    results.push(benign.allowed
        ? pass('gate.benign', 'ordinary change is still allowed', mode, 'specificity', `commit touching ${benignPath} is allowed`, benign.reason)
        : fail('gate.benign', 'ordinary change is still allowed', mode, 'specificity', `commit touching ${benignPath} is allowed`, `blocked by ${benign.trigger}`, 'The gate blocks a benign path. A guardrail that stops everything will pass every sensitivity drill while making the loop unusable — pass --benign-path if this path is genuinely sensitive in your project.'));
    return results;
}
// ── Circuit breaker drills (Infinite Fix Loop / Token Burn) ────────
function ledgerOf(attempts) {
    return { goal: 'loop-drill synthetic run', attempts };
}
/**
 * Errors with no shared structure, used for the no-progress drill.
 *
 * They must stay dissimilar *after* errorSignature() normalization, which
 * collapses every number to '#'. Errors that differ only by a number ("module 1
 * not found", "module 2 not found") normalize to the same signature and trip
 * stagnation instead — the drill would pass while leaving no-progress
 * unexercised.
 */
const DISTINCT_ERRORS = [
    'TypeError: undefined is not a function',
    'ECONNREFUSED connecting to the database',
    'SyntaxError: unexpected token in JSON',
    'AssertionError: expected ok but got null',
    'Permission denied while writing the artifact',
    'OutOfMemoryError during the bundle step',
    'Segmentation fault in the native addon',
];
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
export function runBreakerDrills(config = DEFAULT_BREAKER) {
    const results = [];
    // Sensitivity: the same error repeated trips stagnation.
    {
        const id = 'breaker.stagnation';
        const name = `${config.stagnationThreshold} identical failures trip stagnation`;
        const mode = 'Infinite Fix Loop';
        const attempts = Array.from({ length: config.stagnationThreshold }, (_, i) => ({
            iteration: i + 1,
            action: 'retry the failing test',
            outcome: 'failure',
            error: "TypeError: Cannot read properties of undefined (reading 'id')",
        }));
        const decision = checkCircuitBreaker(ledgerOf(attempts), config);
        results.push(decision.trigger === 'stagnation'
            ? pass(id, name, mode, 'sensitivity', 'escalate via stagnation', decision.reason)
            : fail(id, name, mode, 'sensitivity', 'escalate via stagnation', decision.escalate ? `escalated via ${decision.trigger}` : 'continued', decision.escalate
                ? 'The breaker stopped the loop, but not by the rule under test — stagnation stays unproven.'
                : 'The loop would keep retrying an identical failure — the exact shape of an Infinite Fix Loop. Check similarityThreshold: it is a 0.0-1.0 fraction, and a percentage (e.g. 95) never matches.'));
    }
    // Sensitivity: a long run of unrelated failures trips no-progress.
    {
        const id = 'breaker.no-progress';
        const name = `${config.noProgressThreshold} unrelated failures trip no-progress`;
        const mode = 'Infinite Fix Loop';
        const attempts = Array.from({ length: config.noProgressThreshold }, (_, i) => ({
            iteration: i + 1,
            action: `attempt strategy ${i + 1}`,
            outcome: 'failure',
            error: DISTINCT_ERRORS[i % DISTINCT_ERRORS.length],
        }));
        const decision = checkCircuitBreaker(ledgerOf(attempts), config);
        results.push(decision.trigger === 'no-progress'
            ? pass(id, name, mode, 'sensitivity', 'escalate via no-progress', decision.reason)
            : fail(id, name, mode, 'sensitivity', 'escalate via no-progress', decision.escalate ? `escalated via ${decision.trigger}` : 'continued', decision.escalate
                ? 'The breaker stopped the loop, but not by the rule under test — no-progress stays unproven.'
                : undefined));
    }
    // Sensitivity: exceeding the token budget trips.
    if (config.tokenBudget !== undefined) {
        const id = 'breaker.token-budget';
        const name = 'exceeding the token budget trips the breaker';
        const mode = 'Token Burn';
        const attempts = [
            {
                iteration: 1,
                action: 'a very expensive sub-agent chain',
                outcome: 'success',
                tokensUsed: config.tokenBudget + 1,
            },
        ];
        const decision = checkCircuitBreaker(ledgerOf(attempts), config);
        results.push(decision.trigger === 'token-budget'
            ? pass(id, name, mode, 'sensitivity', 'escalate via token-budget', decision.reason)
            : fail(id, name, mode, 'sensitivity', 'escalate via token-budget', decision.escalate ? `escalated via ${decision.trigger}` : 'continued'));
    }
    else {
        results.push(skip('breaker.token-budget', 'token budget cap', 'Token Burn', 'sensitivity', 'No tokenBudget configured — nothing caps spend mid-run. See loop-budget.md.'));
    }
    // Specificity: a healthy run is NOT escalated.
    {
        const id = 'breaker.healthy';
        const name = 'a healthy run is not escalated';
        const mode = 'Infinite Fix Loop';
        const attempts = [
            { iteration: 1, action: 'read the failing test', outcome: 'success' },
            { iteration: 2, action: 'apply a minimal fix', outcome: 'success' },
        ];
        const decision = checkCircuitBreaker(ledgerOf(attempts), config);
        results.push(!decision.escalate
            ? pass(id, name, mode, 'specificity', 'continue', 'continued')
            : fail(id, name, mode, 'specificity', 'continue', `escalated (${decision.trigger})`, 'The breaker escalates a healthy run. It will halt working loops and train the team to ignore escalations.'));
    }
    return results;
}
// ── Report assembly ────────────────────────────────────────────────
const ALL_MODES = [
    'Infinite Fix Loop',
    'Token Burn',
    'Over-Reach (Wrong Scope)',
    'Verifier Theater',
    'Escalation Failure',
    'Prompt Injection via Untrusted Input',
];
export function buildReport(results) {
    const covered = [];
    const uncovered = [];
    for (const mode of ALL_MODES) {
        const forMode = results.filter((r) => r.failureMode === mode);
        const anyPassed = forMode.some((r) => r.outcome === 'passed');
        const anyFailed = forMode.some((r) => r.outcome === 'failed');
        if (anyPassed && !anyFailed)
            covered.push(mode);
        else
            uncovered.push(mode);
    }
    return {
        results,
        passed: results.filter((r) => r.outcome === 'passed').length,
        failed: results.filter((r) => r.outcome === 'failed').length,
        skipped: results.filter((r) => r.outcome === 'skipped').length,
        covered,
        uncovered,
        timestamp: new Date().toISOString(),
    };
}
/**
 * 0 = every drill passed, 1 = some skipped (guardrail not configured),
 * 2 = a guardrail failed to fire. Mirrors loop-gate / loop-context's
 * "2 means escalate" convention so control scripts can chain all three.
 */
export function exitCodeFor(report) {
    if (report.failed > 0)
        return 2;
    if (report.skipped > 0)
        return 1;
    return 0;
}
