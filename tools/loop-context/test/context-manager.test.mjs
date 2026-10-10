import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  errorSignature,
  checkCircuitBreaker,
  pruneStackTrace,
  pruneLedger,
  summarizeAttempts,
  buildContextInjection,
  calculateSimilarity,
  DEFAULT_BREAKER,
  DEFAULT_PRUNE,
  validateBreakerConfig,
  validatePruneConfig,
  assertSimilarityThreshold,
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

// ── calculateSimilarity ────────────────────────────────────────────

test('calculateSimilarity returns 1.0 for identical strings', () => {
  assert.equal(calculateSimilarity('foo', 'foo'), 1.0);
});

test('calculateSimilarity detects high overlap in phrasing', () => {
  const a = 'Error: connect ECONNREFUSED 127.0.0.1:5432';
  const b = 'Error: connection refused on 127.0.0.1:5432';
  const sim = calculateSimilarity(a, b);
  assert.ok(sim > 0.4 && sim < 1.0, `Similarity was ${sim}`);
});

test('calculateSimilarity returns 0.0 for completely disjoint strings', () => {
  assert.equal(calculateSimilarity('abc', 'xyz'), 0.0);
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

test('breaker trips on stagnation with slightly different wording', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'Error: connection timeout on port 8080' }),
    attempt(2, 'failure', { error: 'Error: timeout on port 8080' }),
    attempt(3, 'failure', { error: 'Error: socket timeout on port 8080' }),
  ]);
  const d = checkCircuitBreaker(l, { ...DEFAULT_BREAKER, similarityThreshold: 0.5 });
  assert.equal(d.escalate, true);
  assert.equal(d.trigger, 'stagnation');
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

// ── circuit breaker: frustration ───────────────────────────────────

test('breaker trips on frustration (semantically similar actions but different errors)', () => {
  const l = ledger([
    attempt(1, 'failure', { action: 'Try to fix the syntax error', error: 'e1' }),
    attempt(2, 'failure', { action: 'I will try to fix the syntax error', error: 'e2' }),
    attempt(3, 'failure', { action: 'Trying to fix the syntax error', error: 'e3' }),
  ]);
  const d = checkCircuitBreaker(l, { ...DEFAULT_BREAKER, similarityThreshold: 0.5 });
  assert.equal(d.escalate, true);
  assert.equal(d.trigger, 'frustration');
  assert.equal(d.shouldContinue, false);
});

test('breaker does not trip on frustration if actions differ', () => {
  const l = ledger([
    attempt(1, 'failure', { action: 'Install missing dependencies', error: 'e1' }),
    attempt(2, 'failure', { action: 'Fix the failing test case', error: 'e2' }),
    attempt(3, 'failure', { action: 'Revert the previous change', error: 'e3' }),
  ]);
  const d = checkCircuitBreaker(l);
  assert.equal(d.escalate, false);
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

test('pruneLedger collapses near-duplicate failures based on similarity', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'Error: connection timeout on port 8080' }),
    attempt(2, 'failure', { error: 'Error: timeout on port 8080' }),
    attempt(3, 'failure', { error: 'Error: socket timeout on port 8080' }),
  ]);
  const pruned = pruneLedger(l, { ...DEFAULT_PRUNE, window: 5, similarityThreshold: 0.5 });
  assert.equal(pruned.attempts.length, 1);
  assert.equal(pruned.attempts[0].repeated, 3);
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

test('summarizeAttempts groups errors by similarity', () => {
  const l = ledger([
    attempt(1, 'failure', { error: 'Error: connection timeout on port 8080' }),
    attempt(2, 'failure', { error: 'Error: timeout on port 8080' }),
    attempt(3, 'failure', { error: 'Error: totally different error' }),
  ]);
  const s = summarizeAttempts(l, 0.5);
  assert.equal(s.distinctErrors.length, 2);
  assert.equal(s.distinctErrors[0].count, 2);
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

// ── config validation ──────────────────────────────────────────────

const identicalFailures = () =>
  ledger([1, 2, 3, 4].map((i) => attempt(i, 'failure', { action: 'same fix', error: 'TypeError: boom' })));

test('checkCircuitBreaker throws on a similarityThreshold above 1 instead of never stagnating', () => {
  // Similarity tops out at 1.0, so 95 (a percentage) silently switched stagnation off.
  for (const similarityThreshold of [95, 1.0001, Infinity]) {
    assert.throws(
      () => checkCircuitBreaker(identicalFailures(), { ...DEFAULT_BREAKER, similarityThreshold }),
      /similarityThreshold must be a fraction/,
      String(similarityThreshold),
    );
  }
});

test('checkCircuitBreaker throws on configs that would switch a rule off', () => {
  const bad = [
    { similarityThreshold: NaN },
    { similarityThreshold: 0 },
    { similarityThreshold: -0.1 },
    { similarityThreshold: '0.85' },
    { maxIterations: 0 },
    { stagnationThreshold: NaN },
    { frustrationThreshold: 2.5 },
    { noProgressThreshold: Infinity },
    { tokenBudget: 0 },
    { tokenBudget: -100 },
  ];
  for (const override of bad) {
    assert.throws(() => checkCircuitBreaker(identicalFailures(), { ...DEFAULT_BREAKER, ...override }), undefined, JSON.stringify(override));
  }
});

test('valid configs, including the boundaries, still trip stagnation', () => {
  for (const similarityThreshold of [1, 0.5, Number.MIN_VALUE]) {
    const d = checkCircuitBreaker(identicalFailures(), { ...DEFAULT_BREAKER, similarityThreshold });
    assert.equal(d.trigger, 'stagnation', String(similarityThreshold));
  }
  assert.doesNotThrow(() => validateBreakerConfig({ ...DEFAULT_BREAKER, tokenBudget: 1 }));
  assert.doesNotThrow(() => validateBreakerConfig(DEFAULT_BREAKER));
  assert.doesNotThrow(() => validatePruneConfig(DEFAULT_PRUNE));
});

test('pruneLedger, summarizeAttempts and buildContextInjection reject a percentage threshold', () => {
  assert.throws(() => pruneLedger(identicalFailures(), { ...DEFAULT_PRUNE, similarityThreshold: 85 }), /If you meant 85%, use 0\.85/);
  assert.throws(() => pruneLedger(identicalFailures(), { ...DEFAULT_PRUNE, window: 0 }), /window must be a positive integer/);
  assert.throws(() => summarizeAttempts(identicalFailures(), 85), /similarityThreshold must be a fraction/);
  assert.throws(
    () => buildContextInjection(identicalFailures(), { ...DEFAULT_BREAKER, similarityThreshold: 85 }),
    /similarityThreshold must be a fraction/,
  );
});

test('assertSimilarityThreshold only gives the percentage hint for whole-number percentages', () => {
  assert.throws(() => assertSimilarityThreshold(95), /If you meant 95%, use 0\.95/);
  assert.throws(() => assertSimilarityThreshold(1.5), (err) => !/If you meant/.test(err.message));
  assert.throws(() => assertSimilarityThreshold(0), (err) => !/never fire/.test(err.message));
  assert.throws(() => assertSimilarityThreshold(150), (err) => /never fire/.test(err.message) && !/If you meant/.test(err.message));
  assert.throws(() => assertSimilarityThreshold(95, '--similarity-threshold'), /^Error: --similarity-threshold must/);
});
