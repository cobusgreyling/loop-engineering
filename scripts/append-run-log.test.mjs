#!/usr/bin/env node
/**
 * Smoke test for scripts/append-run-log.mjs.
 * Run directly (node scripts/append-run-log.test.mjs) or via the validate gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const SCRIPT = new URL('./append-run-log.mjs', import.meta.url).pathname;

test('invalid JSON second arg exits 1 with a Usage / valid JSON message', async () => {
  await assert.rejects(
    exec('node', [SCRIPT, 'not-json', 'ignored.log']),
    (err) => {
      assert.equal(err.code, 1);
      const msg = `${err.stderr}${err.stdout}`;
      assert.match(msg, /Usage|valid JSON/i);
      return true;
    },
  );
});

test('valid minimal JSON entry does not throw on parse', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'append-run-log-'));
  const logPath = path.join(dir, 'loop-run-log.md');
  await writeFile(logPath, '<!-- Loop appends below this line -->\n');
  try {
    const entry = JSON.stringify({ run_id: 'run-1', outcome: 'ok' });
    const { stdout } = await exec('node', [SCRIPT, entry, logPath]);
    assert.match(stdout, /Appended run run-1/);
    const written = await readFile(logPath, 'utf8');
    assert.ok(written.includes('"run_id":"run-1"'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
