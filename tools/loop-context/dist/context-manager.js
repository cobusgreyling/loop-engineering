/**
 * Stateful Memory Manager — Context Manager, Pruner, and Circuit Breaker.
 *
 * Sits between an agent loop and its durable memory (STATE.md, run logs).
 * Before each new iteration it can: summarize what has been tried, prune stale
 * or verbose context (long stack traces, repeated errors), and inject only the
 * essentials into the next prompt — keeping the context window clean and focused.
 *
 * The circuit breaker detects the two classic loop failures the docs warn about:
 *   - stagnant runs (retrying the same error N times)
 *   - no-progress loops (repeated failures with no success)
 * and, together with iteration and token caps, escalates to a human instead of
 * burning tokens in a hopeless loop.
 *
 * All logic here is deterministic and dependency-free — no LLM call is required
 * to summarize or prune, so it is cheap to run on every iteration and easy to test.
 */
export const DEFAULT_BREAKER = {
    maxIterations: 10,
    stagnationThreshold: 3,
    noProgressThreshold: 5,
};
export const DEFAULT_PRUNE = {
    maxTraceLines: 8,
    window: 5,
};
// ── Error normalization ────────────────────────────────────────────
/**
 * Reduce a raw error / stack trace to a stable signature so that "the same
 * error" can be recognized across iterations even when volatile details
 * (line numbers, addresses, timestamps, ports, temp paths) differ.
 */
export function errorSignature(error) {
    const firstLine = error.split('\n').find((l) => l.trim().length > 0) ?? '';
    return firstLine
        .trim()
        .replace(/\b\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?\b/g, '<ts>') // ISO timestamps
        .replace(/0x[0-9a-fA-F]+/g, '<addr>') // hex addresses
        .replace(/[A-Za-z]:[\\/][^\s:]+|(?:[\\/][^\s:/\\]+)+/g, (p) => {
        const parts = p.split(/[\\/]/);
        return parts[parts.length - 1] || p; // collapse paths to basename
    })
        .replace(/:\d+(:\d+)?/g, '') // line:col suffixes
        .replace(/\b\d+\b/g, '#') // any remaining numbers (ports, ids, counts)
        .replace(/\s+/g, ' ')
        .trim();
}
function totalTokens(ledger) {
    return ledger.attempts.reduce((sum, a) => sum + (a.tokensUsed ?? 0), 0);
}
/** Length of the trailing run of failures (since the last non-failure). */
function trailingFailureRun(attempts) {
    const run = [];
    for (let i = attempts.length - 1; i >= 0; i--) {
        if (attempts[i].outcome !== 'failure')
            break;
        run.unshift(attempts[i]);
    }
    return run;
}
/**
 * Decide whether the loop may continue. Checks the most specific and cheapest-
 * to-fix conditions first (stagnation, then no-progress) before the absolute
 * caps (token budget, iteration count), so the reported reason is the most
 * actionable one when several conditions hold.
 */
export function checkCircuitBreaker(ledger, config = DEFAULT_BREAKER) {
    const iterations = ledger.attempts.length;
    const tokensUsed = totalTokens(ledger);
    const base = { iterations, tokensUsed };
    const failRun = trailingFailureRun(ledger.attempts);
    // Stagnation: the same error signature repeated at the tail.
    if (failRun.length >= config.stagnationThreshold) {
        const lastSig = errorSignature(failRun[failRun.length - 1].error ?? '');
        let same = 0;
        for (let i = failRun.length - 1; i >= 0; i--) {
            if (errorSignature(failRun[i].error ?? '') === lastSig)
                same++;
            else
                break;
        }
        if (same >= config.stagnationThreshold) {
            return {
                ...base,
                shouldContinue: false,
                escalate: true,
                trigger: 'stagnation',
                reason: `Same error repeated ${same}× in a row (threshold ${config.stagnationThreshold}): "${lastSig}". Escalating instead of retrying.`,
            };
        }
    }
    // No-progress: many consecutive failures without a success.
    if (failRun.length >= config.noProgressThreshold) {
        return {
            ...base,
            shouldContinue: false,
            escalate: true,
            trigger: 'no-progress',
            reason: `${failRun.length} consecutive failures with no progress (threshold ${config.noProgressThreshold}). Escalating.`,
        };
    }
    // Token budget: absolute spend cap.
    if (config.tokenBudget !== undefined && tokensUsed >= config.tokenBudget) {
        return {
            ...base,
            shouldContinue: false,
            escalate: true,
            trigger: 'token-budget',
            reason: `Token budget reached (${tokensUsed} ≥ ${config.tokenBudget}). Escalating to avoid cost blowup.`,
        };
    }
    // Iteration cap: absolute count.
    if (iterations >= config.maxIterations) {
        return {
            ...base,
            shouldContinue: false,
            escalate: true,
            trigger: 'max-iterations',
            reason: `Iteration cap reached (${iterations} ≥ ${config.maxIterations}). Escalating.`,
        };
    }
    return {
        ...base,
        shouldContinue: true,
        escalate: false,
        trigger: 'ok',
        reason: 'Within limits — cleared to continue.',
    };
}
// ── Pruning ────────────────────────────────────────────────────────
/** Truncate a stack trace to its most useful head, noting how much was dropped. */
export function pruneStackTrace(trace, maxLines) {
    const lines = trace.split('\n');
    if (lines.length <= maxLines)
        return trace.trim();
    const kept = lines.slice(0, maxLines).join('\n').trimEnd();
    const omitted = lines.length - maxLines;
    return `${kept}\n  … (${omitted} more line${omitted === 1 ? '' : 's'} pruned)`;
}
/**
 * Produce a lean ledger for injection: keep only the most-recent `window`
 * attempts, prune verbose traces, and collapse consecutive identical failures
 * into a single entry with a repeat count. The full ledger is untouched — this
 * returns a new object.
 */
export function pruneLedger(ledger, config = DEFAULT_PRUNE) {
    const recent = ledger.attempts.slice(-config.window);
    const collapsed = [];
    for (const attempt of recent) {
        const pruned = {
            ...attempt,
            ...(attempt.error !== undefined
                ? { error: pruneStackTrace(attempt.error, config.maxTraceLines) }
                : {}),
        };
        const prev = collapsed[collapsed.length - 1];
        const sameFailure = prev !== undefined &&
            prev.outcome === 'failure' &&
            pruned.outcome === 'failure' &&
            errorSignature(prev.error ?? '') === errorSignature(pruned.error ?? '');
        if (sameFailure) {
            prev.repeated = (prev.repeated ?? 1) + 1;
            prev.iteration = pruned.iteration; // advance to the latest iteration
        }
        else {
            collapsed.push(pruned);
        }
    }
    return { goal: ledger.goal, startedAt: ledger.startedAt, attempts: collapsed };
}
/** Deterministic factual rollup of the whole run — no LLM required. */
export function summarizeAttempts(ledger) {
    const groups = new Map();
    const actions = new Set();
    let successes = 0;
    let failures = 0;
    let noops = 0;
    for (const a of ledger.attempts) {
        actions.add(a.action);
        if (a.outcome === 'success')
            successes++;
        else if (a.outcome === 'noop')
            noops++;
        else {
            failures++;
            if (a.error) {
                const sig = errorSignature(a.error);
                const existing = groups.get(sig);
                if (existing)
                    existing.count++;
                else
                    groups.set(sig, { signature: sig, count: 1, sample: a.error.split('\n')[0].trim() });
            }
        }
    }
    return {
        totalAttempts: ledger.attempts.length,
        successes,
        failures,
        noops,
        tokensUsed: totalTokens(ledger),
        distinctErrors: [...groups.values()].sort((a, b) => b.count - a.count),
        actionsTried: [...actions],
    };
}
// ── Injection ──────────────────────────────────────────────────────
/**
 * Build the compact context block to prepend to the next prompt. Contains only
 * what the agent needs to make progress: the goal, what has already been tried
 * (so it does not repeat itself), the last pruned error, and the breaker status.
 */
export function buildContextInjection(ledger, breaker = DEFAULT_BREAKER, prune = DEFAULT_PRUNE) {
    const summary = summarizeAttempts(ledger);
    const decision = checkCircuitBreaker(ledger, breaker);
    const pruned = pruneLedger(ledger, prune);
    const lines = [];
    lines.push('## Loop Context (managed)');
    lines.push('');
    lines.push(`**Goal:** ${ledger.goal}`);
    lines.push(`**Progress:** iteration ${summary.totalAttempts} · ${summary.successes} ok · ${summary.failures} failed` +
        (summary.tokensUsed ? ` · ${summary.tokensUsed} tokens` : ''));
    lines.push('');
    if (summary.actionsTried.length > 0) {
        lines.push('**Already tried (do NOT repeat):**');
        for (const action of summary.actionsTried)
            lines.push(`- ${action}`);
        lines.push('');
    }
    if (summary.distinctErrors.length > 0) {
        lines.push('**Failure patterns:**');
        for (const g of summary.distinctErrors) {
            lines.push(`- (${g.count}×) ${g.sample}`);
        }
        lines.push('');
    }
    const lastFail = [...pruned.attempts].reverse().find((a) => a.outcome === 'failure');
    if (lastFail?.error) {
        lines.push('**Most recent error (pruned):**');
        lines.push('```');
        lines.push(lastFail.error);
        lines.push('```');
        lines.push('');
    }
    lines.push(decision.escalate
        ? `> STOP — circuit breaker tripped (${decision.trigger}). ${decision.reason}`
        : `> Circuit breaker: OK (${decision.iterations}/${breaker.maxIterations} iterations used).`);
    return lines.join('\n');
}
