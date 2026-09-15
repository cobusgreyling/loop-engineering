import test from 'node:test';
import assert from 'node:assert';
import { filterEntries, aggregateMetrics } from '../dist/metrics.js';

test('loop-metrics filters and aggregates', () => {
  const entries = [
    { run_id: '2026-07-29T08:53:29Z', pattern: 'daily-triage', duration_s: 8, items_found: 1, actions_taken: 1, escalations: 0, tokens_estimate: 52000, outcome: 'report-only' },
    { run_id: '2026-07-30T08:50:34Z', pattern: 'daily-triage', duration_s: 5, items_found: 1, actions_taken: 2, escalations: 1, tokens_estimate: 52000, outcome: 'report-only' },
  ];

  const filtered = filterEntries(entries, 'daily-triage');
  assert.strictEqual(filtered.length, 2);

  const metrics = aggregateMetrics(filtered);
  assert.strictEqual(metrics.totalRuns, 2);
  assert.strictEqual(metrics.totalTokens, 104000);
  assert.strictEqual(metrics.totalActionsTaken, 3);
  assert.strictEqual(metrics.totalEscalations, 1);
  assert.strictEqual(metrics.roiScore, (3 * 10) - (1 * 5)); // 25
  assert.strictEqual(metrics.successRatePct, 50); // 1 of 2 runs had no escalation
});

test('successRatePct stays within [0, 100] when a single run logs more than one escalation', () => {
  // A run can escalate several items in one pass (this repo's own
  // loop-run-log.md has real entries with escalations: 4 and 5), so
  // totalEscalations (a sum of per-run counts) can exceed totalRuns.
  // successRatePct must still reflect "runs that didn't escalate", not go
  // negative from subtracting an event count as if it were a run count.
  const entries = [
    { run_id: 'a', pattern: 'ci-sweeper', duration_s: 1, items_found: 5, actions_taken: 1, escalations: 5, tokens_estimate: 1000, outcome: 'escalated' },
    { run_id: 'b', pattern: 'ci-sweeper', duration_s: 1, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'report-only' },
  ];

  const metrics = aggregateMetrics(entries);
  assert.strictEqual(metrics.totalEscalations, 5);
  assert.strictEqual(metrics.successRatePct, 50); // 1 of 2 runs had no escalation
  assert.ok(metrics.successRatePct >= 0 && metrics.successRatePct <= 100);
});

test('filterEntries keeps non-ISO run IDs and filters ISO dates within a timeframe', (t) => {
  const RealDate = Date;
  t.mock.method(globalThis, 'Date', class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ['2026-08-01T12:00:00Z']));
    }
  });

  const entries = [
    { run_id: '2026-07-30T08:50:34Z', pattern: 'daily-triage', duration_s: 5, items_found: 1, actions_taken: 2, escalations: 1, tokens_estimate: 52000, outcome: 'report-only' },
    ...['29231015995', 'run-1', '123', '2026', 'custom-run', '2026-99-99'].map(run_id => ({
      run_id, pattern: 'daily-triage', duration_s: 8, items_found: 1, actions_taken: 1, escalations: 0, tokens_estimate: 52000, outcome: 'report-only'
    })),
    { run_id: '2026-06-01T08:50:34Z', pattern: 'daily-triage', duration_s: 5, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'no-op' },
    { run_id: 'run-2', pattern: 'ci-sweeper', duration_s: 5, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'no-op' },
  ];

  const filtered = filterEntries(entries, 'daily-triage', 30);
  assert.deepStrictEqual(filtered.map(e => e.run_id), [
    '2026-07-30T08:50:34Z', '29231015995', 'run-1', '123', '2026', 'custom-run', '2026-99-99'
  ]);
  assert.strictEqual(filterEntries(entries), entries, 'no filters preserve every entry');
});
