import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/cli.js',
);

function runWithTokens(total) {
  const dir = mkdtempSync(path.join(tmpdir(), 'loop-metrics-'));
  try {
    const log = path.join(dir, 'loop-run-log.md');
    writeFileSync(
      log,
      [
        '# Loop Run Log',
        '',
        '<!-- Loop appends below this line -->',
        JSON.stringify({
          run_id: '2026-11-19T01:00:00Z',
          pattern: 'daily-triage',
          duration_s: 1,
          items_found: 0,
          actions_taken: 1,
          escalations: 0,
          tokens_estimate: total,
          outcome: 'report-only',
        }),
        '',
      ].join('\n'),
    );
    const result = spawnSync(process.execPath, [CLI, '--log', log], {
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, result.stderr);
    return result.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a rounded kilo count crosses over to M instead of printing 1000k', () => {
  // Math.round(999_500 / 1000) is 1000, but the branch was chosen on the
  // original value, so the CLI printed "1000k" next to a plain "1.0M".
  const out = runWithTokens(999_500);
  assert.match(out, /1\.0M/);
  assert.doesNotMatch(out, /1000k/);
});

test('the k/M boundary stays monotonic on both sides', () => {
  assert.match(runWithTokens(999_499), /999k/);
  assert.match(runWithTokens(1_000_000), /1\.0M/);
});
