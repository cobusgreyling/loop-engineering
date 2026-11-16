import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist/cli.js');

async function freshGateDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-gate-cli-'));
  await writeFile(
    path.join(dir, 'gate.yaml'),
    'version: 1\ndenylist:\n  - ".env"\n  - "auth/**"\nmaxFiles: 3\nautoMergeAllowlist:\n  - "docs/**"\n',
  );
  return dir;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('cli check allows an in-policy commit', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit', '--paths', 'src/index.ts', '--json'], dir);
  assert.equal(r.status, 0);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.allowed, true);
});

test('cli check escalates on a denylist hit', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit', '--paths', 'auth/login.ts', '--json'], dir);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'denylist');
});

test('cli check escalates auto-merge on a non-allowlisted path', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'auto-merge', '--paths', 'src/index.ts'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /not-allowlisted/);
});

test('cli check allows auto-merge on an allowlisted path', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'auto-merge', '--paths', 'docs/readme.md'], dir);
  assert.equal(r.status, 0);
});

test('cli check rejects an invalid action', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'deploy', '--paths', 'x.ts'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid --action: deploy/);
});

test('cli check rejects --paths that is whitespace/commas only, not silently allowed', async () => {
  const dir = await freshGateDir();
  const whitespaceOnly = runCli(['check', '--action', 'commit', '--paths', ' '], dir);
  assert.equal(whitespaceOnly.status, 1);
  assert.match(whitespaceOnly.stderr, /--paths must contain at least one non-empty path/);

  const commasOnly = runCli(['check', '--action', 'commit', '--paths', ',,,'], dir);
  assert.equal(commasOnly.status, 1);
  assert.match(commasOnly.stderr, /--paths must contain at least one non-empty path/);
});

test('cli check requires --action and --paths', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /check requires --action and --paths/);
});

test('cli check surfaces a missing gate file clearly', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-gate-cli-empty-'));
  const r = runCli(['check', '--action', 'commit', '--paths', 'x.ts'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Gate config not found/);
});

test('cli check honors --gate-file', async () => {
  const dir = await freshGateDir();
  const customPath = path.join(dir, 'custom-gate.yaml');
  await writeFile(customPath, 'version: 1\ndenylist:\n  - "custom/**"\n');
  const r = runCli(['check', '--action', 'commit', '--paths', 'custom/x.ts', '--gate-file', customPath, '--json'], dir);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'denylist');
});

test('cli --help prints usage and exits 0', () => {
  const r = runCli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /loop-gate/);
});

test('cli unknown command exits 1', () => {
  const r = runCli(['bogus']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown command/);
});

for (const nextFlag of ['--json', '--gate-file', '--help', '-h']) {
  test(`cli check rejects ${nextFlag} as a missing --paths value`, async (t) => {
    const dir = await freshGateDir();
    t.after(() => rm(dir, { recursive: true, force: true }));
    const r = runCli(['check', '--action', 'commit', '--paths', nextFlag], dir);
    assert.equal(r.status, 1, r.stdout);
    assert.equal(r.stdout, '', 'an incomplete invocation must not emit an allowed decision');
    assert.match(r.stderr, /--paths requires/);
  });
}

test('cli check rejects a terminal bare --paths with no value', async (t) => {
  const dir = await freshGateDir();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = runCli(['check', '--action', 'commit', '--paths'], dir);
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.stdout, '', 'an incomplete invocation must not emit an allowed decision');
  assert.match(r.stderr, /--paths requires/);
});

test('cli check accepts an option-like filename with a ./ prefix', async (t) => {
  const dir = await freshGateDir();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = runCli(['check', '--action', 'commit', '--paths', './--json', '--json'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).allowed, true);
});
