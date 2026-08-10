import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(scriptsDir, 'append-run-log.mjs');
const MARKER = '<!-- Loop appends below this line -->';

test('invalid JSON entry exits 1 with a Usage message', async () => {
  let code = 0;
  let stderr = '';
  try {
    await exec('node', [SCRIPT, 'not-json']);
  } catch (err) {
    code = err.code;
    stderr = err.stderr;
  }
  assert.strictEqual(code, 1, 'Should exit with code 1');
  assert.match(stderr, /Usage/, 'Should print a Usage message');
  assert.match(stderr, /valid JSON/, 'Should mention valid JSON');
});

test('valid minimal JSON entry is appended without throwing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(scriptsDir, '.test-run-log-'));
  const logPath = path.join(tmpDir, 'loop-run-log.md');
  await fs.writeFile(logPath, `# Run Log\n\n${MARKER}\n`);

  const entry = { run_id: new Date().toISOString(), status: 'ok' };
  const { stdout } = await exec('node', [SCRIPT, JSON.stringify(entry), logPath]);
  assert.match(stdout, /Appended run/, 'Should confirm the append');

  const content = await fs.readFile(logPath, 'utf8');
  assert.ok(content.includes(JSON.stringify(entry)), 'Log should contain the new entry');

  await fs.rm(tmpDir, { recursive: true, force: true });
});
