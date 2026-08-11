import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = await import(pathToFileURL(path.resolve(__dirname, '../dist/files.js')).href);

test('parseRunLog extracts trailing JSON lines newest first', () => {
  const content = `
# Log
{"run_id":"a","pattern":"daily-triage","outcome":"report-only"}
not json
{"run_id":"b","pattern":"ci-sweeper","outcome":"fix-proposed"}
`;
  const entries = files.parseRunLog(content, 5);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].run_id, 'b');
  assert.equal(entries[1].run_id, 'a');
});

test('extractPatternsFromLoop finds known pattern names', () => {
  const loop = `
### Daily Triage (L1)
### PR Babysitter
Something about changelog-drafter in prose
`;
  const p = files.extractPatternsFromLoop(loop);
  assert.ok(p.includes('daily-triage'));
  assert.ok(p.includes('pr-babysitter'));
  assert.ok(p.includes('changelog-drafter'));
});

test('parseLedger handles missing and valid', () => {
  assert.equal(files.parseLedger(null).present, false);
  const L = files.parseLedger(
    JSON.stringify({ pattern: 'ci-sweeper', level: 'L2', attempts: [{}, {}] }),
  );
  assert.equal(L.present, true);
  assert.equal(L.pattern, 'ci-sweeper');
  assert.equal(L.attempts, 2);
});
