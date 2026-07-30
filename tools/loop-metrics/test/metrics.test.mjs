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
});
