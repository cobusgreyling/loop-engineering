import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  errorSignature,
  checkCircuitBreaker,
  pruneStackTrace,
  pruneLedger,
  summarizeAttempts,
  buildContextInjection,
  DEFAULT_BREAKER,
  DEFAULT_PRUNE,
} from '../dist/context-manager.js';

function attempt(iteration, outcome, opts = {}) {
  return { iteration, action: opts.action ?? `try ${iteration}`, outcome, ...opts };
}

function ledger(attempts, goal = 'make the build green') {
  return { goal, attempts };
}

// ── errorSignature ─────────────────────────────────────────────────

test('errorSignature normalizes volatile details to a stable key', () => {
  const a = errorSignature('TypeError: cannot read x at /home/u/app/foo.js:12:5');
  const b = errorSignature('TypeError: cannot read x at /tmp/build/foo.js:88:9');
  assert.equal(a, b);
});

test('errorSignature collapses ports and addresses', () => {
  const a = errorSignature('Error: connect ECONNREFUSED 127.0.0.1:5432');
  const b = errorSignature('Error: connect ECONNREFUSED 127.0.0.1:5433');
  assert.equal(a, b);
});

test('errorSignature keeps genuinely different errors distinct', () => {
  const a = errorSignature('TypeError: undefined is not a function');
  const b = errorSignature('ReferenceError: foo is not defined');
  assert.notEqual(a, b);
});

// ── circuit breaker: stagnation ────────────────────────────────────

test('breaker trips on stagnation (same error 3× in a row)', () => {
  const err = 'Error: connect ECONNREFUSED 127.0.0.1:5432';
  const l = ledger([
    attempt(1, 'failure', { error: err }),
    attempt(2, 'failure', { error: err }),
    attempt(3, 'failure', { error: err }),
  ]);
  const d = checkCircuitBreaker(l);
  assert.equal(d.escalate, true);
  assert.equal(d.trigger, 'stagnation');
  assert.equal(d.shouldContinue, false);
});

test('breaker does not trip when errors differ each time', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'TypeError: a' }),
    attempt(2, 'failure', { error: 'ReferenceError: b' }),
  ]);
  const d = checkCircuitBreaker(l);
  assert.equal(d.escalate, false);
  assert.equal(d.trigger, 'ok');
});

test('breaker stagnation resets after a success', () => {
  const err = 'Error: boom';
  const l = ledger([
    attempt(1, 'failure', { error: err }),
    attempt(2, 'failure', { error: err }),
    attempt(3, 'success'),
    attempt(4, 'failure', { error: err }),
  ]);
  const d = checkCircuitBreaker(l);
  assert.equal(d.escalate, false, 'trailing failure run is only 1 after the success');
});

// ── circuit breaker: no-progress ───────────────────────────────────

test('breaker trips on no-progress (consecutive failures, distinct errors)', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'e1' }),
    attempt(2, 'failure', { error: 'e2' }),
    attempt(3, 'failure', { error: 'e3' }),
    attempt(4, 'failure', { error: 'e4' }),
    attempt(5, 'failure', { error: 'e5' }),
  ]);
  const d = checkCircuitBreaker(l, { ...DEFAULT_BREAKER, stagnationThreshold: 99 });
  assert.equal(d.escalate, true);
  assert.equal(d.trigger, 'no-progress');
});

// ── circuit breaker: caps ──────────────────────────────────────────

test('breaker trips on token budget', () => {
  const l = ledger([
    attempt(1, 'noop', { tokensUsed: 600 }),
    attempt(2, 'noop', { tokensUsed: 600 }),
  ]);
  const d = checkCircuitBreaker(l, { ...DEFAULT_BREAKER, tokenBudget: 1000 });
  assert.equal(d.trigger, 'token-budget');
  assert.equal(d.tokensUsed, 1200);
});

test('breaker trips on iteration cap', () => {
  const attempts = [];
  for (let i = 1; i <= 10; i++) attempts.push(attempt(i, 'noop'));
  const d = checkCircuitBreaker(ledger(attempts), { ...DEFAULT_BREAKER, maxIterations: 10 });
  assert.equal(d.trigger, 'max-iterations');
});

test('breaker clears an empty ledger', () => {
  const d = checkCircuitBreaker(ledger([]));
  assert.equal(d.shouldContinue, true);
  assert.equal(d.iterations, 0);
});

// ── pruning ────────────────────────────────────────────────────────

test('pruneStackTrace keeps head and notes omissions', () => {
  const trace = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
  const pruned = pruneStackTrace(trace, 5);
  assert.ok(pruned.includes('line 0'));
  assert.ok(pruned.includes('15 more lines pruned'));
  assert.ok(!pruned.includes('line 19'));
});

test('pruneStackTrace leaves short traces intact', () => {
  const trace = 'line 0\nline 1';
  assert.equal(pruneStackTrace(trace, 5), trace);
});

test('pruneLedger keeps only the recent window', () => {
  const attempts = [];
  for (let i = 1; i <= 12; i++) attempts.push(attempt(i, 'noop'));
  const pruned = pruneLedger(ledger(attempts), { ...DEFAULT_PRUNE, window: 3 });
  assert.equal(pruned.attempts.length, 3);
  assert.equal(pruned.attempts[2].iteration, 12);
});

test('pruneLedger collapses consecutive identical failures with a count', () => {
  const err = 'Error: same thing';
  const l = ledger([
    attempt(1, 'failure', { error: err }),
    attempt(2, 'failure', { error: err }),
    attempt(3, 'failure', { error: err }),
  ]);
  const pruned = pruneLedger(l, { ...DEFAULT_PRUNE, window: 5 });
  assert.equal(pruned.attempts.length, 1);
  assert.equal(pruned.attempts[0].repeated, 3);
  assert.equal(pruned.attempts[0].iteration, 3);
});

test('pruneLedger does not mutate the input ledger', () => {
  const l = ledger([attempt(1, 'failure', { error: 'x'.repeat(10) + '\n'.repeat(20) })]);
  const before = JSON.stringify(l);
  pruneLedger(l);
  assert.equal(JSON.stringify(l), before);
});

// ── summarization ──────────────────────────────────────────────────

test('summarizeAttempts groups errors by signature, most frequent first', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'Error: connect ECONNREFUSED 127.0.0.1:5432', action: 'run migration' }),
    attempt(2, 'failure', { error: 'Error: connect ECONNREFUSED 127.0.0.1:5433', action: 'run migration' }),
    attempt(3, 'failure', { error: 'TypeError: x', action: 'patch code' }),
    attempt(4, 'success', { action: 'patch code' }),
  ]);
  const s = summarizeAttempts(l);
  assert.equal(s.totalAttempts, 4);
  assert.equal(s.failures, 3);
  assert.equal(s.successes, 1);
  assert.equal(s.distinctErrors[0].count, 2, 'ECONNREFUSED collapses to one group of 2');
  assert.deepEqual(s.actionsTried, ['run migration', 'patch code']);
});

// ── injection ──────────────────────────────────────────────────────

test('buildContextInjection includes goal, tried actions, and breaker status', () => {
  const err = 'Error: boom';
  const l = ledger([
    attempt(1, 'failure', { error: err, action: 'approach A' }),
    attempt(2, 'failure', { error: err, action: 'approach A' }),
    attempt(3, 'failure', { error: err, action: 'approach A' }),
  ]);
  const block = buildContextInjection(l);
  assert.ok(block.includes('make the build green'));
  assert.ok(block.includes('approach A'));
  assert.ok(block.includes('do NOT repeat'));
  assert.ok(block.includes('STOP'), 'stagnation should surface a STOP directive');
});

test('buildContextInjection shows OK status for a healthy run', () => {
  const l = ledger([attempt(1, 'noop'), attempt(2, 'success')]);
  const block = buildContextInjection(l);
  assert.ok(block.includes('Circuit breaker: OK'));
});
