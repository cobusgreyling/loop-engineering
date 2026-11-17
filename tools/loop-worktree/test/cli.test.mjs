import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist/cli.js');

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

async function freshDir() {
  return mkdtemp(path.join(tmpdir(), 'loop-worktree-cli-'));
}

function runCli(args, root) {
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
}

test('cli lock requires --paths and --owner', async () => {
  const dir = await freshDir();
  const r = runCli(['lock', '--owner', 'ci-sweeper'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /lock requires --paths and --owner/);
});

test('cli lock/locks/unlock round-trip', async () => {
  const dir = await freshDir();

  const locked = runCli(['lock', '--paths', 'package.json,package-lock.json', '--owner', 'dependency-sweeper'], dir);
  assert.equal(locked.status, 0);
  assert.match(locked.stdout, /locked package\.json, package-lock\.json for dependency-sweeper/);

  const listed = runCli(['locks', '--json'], dir);
  assert.equal(listed.status, 0);
  const { locks } = JSON.parse(listed.stdout);
  assert.equal(locks.length, 1);
  assert.equal(locks[0].owner, 'dependency-sweeper');

  const unlocked = runCli(['unlock', '--owner', 'dependency-sweeper'], dir);
  assert.equal(unlocked.status, 0);
  assert.match(unlocked.stdout, /unlocked dependency-sweeper/);

  const listedAfter = runCli(['locks', '--json'], dir);
  assert.deepEqual(JSON.parse(listedAfter.stdout).locks, []);
});

test('cli lock surfaces an overlap error from a different owner', () => {
  return freshDir().then((dir) => {
    const first = runCli(['lock', '--paths', 'package.json', '--owner', 'dependency-sweeper'], dir);
    assert.equal(first.status, 0);

    const second = runCli(['lock', '--paths', 'package.json', '--owner', 'ci-sweeper'], dir);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /locked by owner "dependency-sweeper"/);
  });
});

test('cli unlock on an owner with no lock is a no-op, not an error', async () => {
  const dir = await freshDir();
  const r = runCli(['unlock', '--owner', 'nobody'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nobody held no lock/);
});

test('cli locks --sweep reports expired locks report-only, removes with --force', async () => {
  const dir = await freshDir();
  const locked = runCli(['lock', '--paths', 'package.json', '--owner', 'ci-sweeper', '--ttl', '30m'], dir);
  assert.equal(locked.status, 0);

  const { readFile, writeFile } = await import('node:fs/promises');
  const file = path.join(dir, '.loop-worktrees', 'locks', 'ci-sweeper.json');
  const stale = JSON.parse(await readFile(file, 'utf8'));
  stale.expiresAt = new Date(Date.now() - 1000).toISOString();
  await writeFile(file, JSON.stringify(stale));

  const reported = runCli(['locks', '--sweep', '--json'], dir);
  assert.equal(reported.status, 0);
  const reportedResult = JSON.parse(reported.stdout);
  assert.equal(reportedResult.expired.length, 1);
  assert.equal(reportedResult.removed.length, 0);

  const swept = runCli(['locks', '--sweep', '--force', '--json'], dir);
  const sweptResult = JSON.parse(swept.stdout);
  assert.deepEqual(sweptResult.removed, ['ci-sweeper']);
});

test('cli rejects a flag whose value is missing or is the next flag', async () => {
  const dir = await freshDir();

  // "--paths" followed by another flag: the flag used to be read as the value.
  const nibbled = runCli(['lock', '--paths', '--owner', 'ci-sweeper'], dir);
  assert.equal(nibbled.status, 1);
  assert.match(nibbled.stderr, /--paths needs a value/);
  assert.equal(existsSync(path.join(dir, '.loop-worktrees', 'locks', 'ci-sweeper.json')), false);

  // A value flag with nothing after it at all.
  const missing = runCli(['lock', '--paths'], dir);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--paths needs a value/);
});

test('cli create does not build a worktree named after a flag', async () => {
  const dir = await freshDir();
  git(dir, 'init', '-q', '-b', 'main', '.');
  git(dir, '-c', 'user.email=loop@example.com', '-c', 'user.name=loop', 'commit', '-q', '--allow-empty', '-m', 'init');

  // The run id was left out: "--pattern" used to become the id, so the guard
  // ("create requires --run-id and --pattern") passed and a `loop/--pattern`
  // branch plus .loop-worktrees/--pattern were created for real.
  const r = runCli(['create', '--run-id', '--pattern', 'daily-triage'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--run-id needs a value/);
  assert.equal(git(dir, 'branch', '--list', 'loop/*').trim(), '');
  assert.equal(existsSync(path.join(dir, '.loop-worktrees', '--pattern')), false);
});
