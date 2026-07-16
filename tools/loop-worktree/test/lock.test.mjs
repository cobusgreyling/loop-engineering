import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { lockPaths, unlockOwner, listLocks, sweepExpiredLocks, pathsOverlap, isExpired } from '../dist/lock.js';

async function freshDir() {
  return mkdtemp(path.join(tmpdir(), 'loop-worktree-lock-'));
}

test('pathsOverlap: exact match, glob prefix, and distinct files', () => {
  assert.equal(pathsOverlap('package.json', 'package.json'), true);
  assert.equal(pathsOverlap('src/**', 'src/foo.ts'), true);
  assert.equal(pathsOverlap('src/foo.ts', 'src/**'), true);
  assert.equal(pathsOverlap('package.json', 'package-lock.json'), false);
});

test('pathsOverlap respects path-segment boundaries, not raw string prefixes', () => {
  // A shared literal character prefix across segments must not count as overlap.
  assert.equal(pathsOverlap('docs/api', 'docs/apidocs.md'), false);
  assert.equal(pathsOverlap('src/foo', 'src/foobar.ts'), false);
  // But a wildcard segment still covers a deeper, more specific path.
  assert.equal(pathsOverlap('src/**', 'src/nested/foo.ts'), true);
});

test('lockPaths acquires a lock with no TTL by default', async () => {
  const dir = await freshDir();
  const entry = await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });
  assert.equal(entry.owner, 'ci-sweeper');
  assert.deepEqual(entry.paths, ['package.json']);
  assert.equal(entry.expiresAt, undefined);
  assert.equal(isExpired(entry), false);
});

test('lockPaths sets expiresAt from --ttl', async () => {
  const dir = await freshDir();
  const entry = await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'], ttl: '30m' });
  assert.ok(entry.expiresAt);
  assert.ok(Date.parse(entry.expiresAt) > Date.now());
});

test('lockPaths rejects an overlapping path already locked by another owner', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['package.json', 'package-lock.json'] });
  await assert.rejects(
    () => lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] }),
    /locked by owner "dependency-sweeper"/,
  );
});

test('lockPaths allows non-overlapping paths from a different owner', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['package.json'] });
  const entry = await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['tests/**'] });
  assert.equal(entry.owner, 'ci-sweeper');
});

test('lockPaths lets the same owner re-lock (replace, not stack)', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });
  const second = await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['tests/**'] });
  assert.deepEqual(second.paths, ['tests/**']);
  const locks = await listLocks(dir);
  assert.equal(locks.length, 1);
});

test('an expired lock no longer blocks a new lock on the same paths', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['package.json'], ttl: '30m' });
  // Force the just-written lock into the past instead of waiting 30 minutes.
  const { writeFile, readFile } = await import('node:fs/promises');
  const file = path.join(dir, '.loop-worktrees', 'locks', 'dependency-sweeper.json');
  const stale = JSON.parse(await readFile(file, 'utf8'));
  stale.expiresAt = new Date(Date.now() - 1000).toISOString();
  await writeFile(file, JSON.stringify(stale));

  const entry = await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });
  assert.equal(entry.owner, 'ci-sweeper');
});

test('lockPaths rejects an owner name that would escape the locks directory', async () => {
  const dir = await freshDir();
  await assert.rejects(
    () => lockPaths({ root: dir, owner: '../../escaped', paths: ['package.json'] }),
    /Invalid --owner/,
  );
});

test('unlockOwner rejects an invalid owner name the same way', async () => {
  const dir = await freshDir();
  await assert.rejects(() => unlockOwner(dir, '../../escaped'), /Invalid --owner/);
});

test('a corrupt lock file surfaces a clear error instead of crashing every owner', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(dir, '.loop-worktrees', 'locks', 'dependency-sweeper.json'), '{not valid json');

  await assert.rejects(() => listLocks(dir), /Corrupt lock file/);
  await assert.rejects(
    () => lockPaths({ root: dir, owner: 'pr-babysitter', paths: ['tests/**'] }),
    /Corrupt lock file/,
  );
});

test('concurrent lockPaths calls on overlapping paths: exactly one wins', async () => {
  const dir = await freshDir();
  const owners = ['ci-sweeper', 'dependency-sweeper', 'pr-babysitter'];
  const results = await Promise.allSettled(
    owners.map((owner) => lockPaths({ root: dir, owner, paths: ['package.json'] })),
  );
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'exactly one racing lock call should succeed');
  const locks = await listLocks(dir);
  assert.equal(locks.length, 1);
});

test('unlockOwner releases a lock; is a no-op if none held', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });
  assert.equal(await unlockOwner(dir, 'ci-sweeper'), true);
  assert.equal((await listLocks(dir)).length, 0);
  assert.equal(await unlockOwner(dir, 'ci-sweeper'), false);
});

test('sweepExpiredLocks reports but does not delete without --force', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'], ttl: '30m' });
  const { writeFile, readFile } = await import('node:fs/promises');
  const file = path.join(dir, '.loop-worktrees', 'locks', 'ci-sweeper.json');
  const stale = JSON.parse(await readFile(file, 'utf8'));
  stale.expiresAt = new Date(Date.now() - 1000).toISOString();
  await writeFile(file, JSON.stringify(stale));

  const result = await sweepExpiredLocks(dir);
  assert.equal(result.expired.length, 1);
  assert.equal(result.removed.length, 0);
  assert.equal((await listLocks(dir)).length, 1);
});

test('sweepExpiredLocks removes with --force, leaves active locks untouched', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'], ttl: '30m' });
  await lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['tests/**'] });
  const { writeFile, readFile } = await import('node:fs/promises');
  const file = path.join(dir, '.loop-worktrees', 'locks', 'ci-sweeper.json');
  const stale = JSON.parse(await readFile(file, 'utf8'));
  stale.expiresAt = new Date(Date.now() - 1000).toISOString();
  await writeFile(file, JSON.stringify(stale));

  const result = await sweepExpiredLocks(dir, { force: true });
  assert.deepEqual(result.removed, ['ci-sweeper']);
  const remaining = await listLocks(dir);
  assert.deepEqual(remaining.map((l) => l.owner), ['dependency-sweeper']);
});

test('lockPaths with --wait queues and acquires lock when released', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });

  // Start a wait in the background
  const p = lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['package.json'], wait: '10s' });

  // Ensure the wait intent is written
  await new Promise(r => setTimeout(r, 50));
  const { listWaits } = await import('../dist/lock.js');
  const waits = await listWaits(dir);
  assert.equal(waits.length, 1);
  assert.equal(waits[0].owner, 'dependency-sweeper');
  assert.deepEqual(waits[0].waitingOn, ['ci-sweeper']);

  // Release the lock
  await unlockOwner(dir, 'ci-sweeper');

  // Background lock should now succeed
  const entry = await p;
  assert.equal(entry.owner, 'dependency-sweeper');
  
  // Wait intent should be cleaned up
  assert.equal((await listWaits(dir)).length, 0);
});

test('lockPaths with --wait times out', async () => {
  const dir = await freshDir();
  await lockPaths({ root: dir, owner: 'ci-sweeper', paths: ['package.json'] });

  const start = Date.now();
  await assert.rejects(
    () => lockPaths({ root: dir, owner: 'dependency-sweeper', paths: ['package.json'], wait: '1s' }),
    /Timed out waiting for lock on paths/
  );
  assert.ok(Date.now() - start >= 1000);

  const { listWaits } = await import('../dist/lock.js');
  assert.equal((await listWaits(dir)).length, 0);
});

test('lockPaths deadlock detection aborts cycle immediately', async () => {
  const dir = await freshDir();
  
  // A holds package.json
  await lockPaths({ root: dir, owner: 'A', paths: ['package.json'] });
  // B holds src/**
  await lockPaths({ root: dir, owner: 'B', paths: ['src/**'] });

  // A wants src/** and waits on B
  const pA = lockPaths({ root: dir, owner: 'A', paths: ['src/**'], wait: '10s' });

  await new Promise(r => setTimeout(r, 50));

  // B wants package.json and waits on A - this should throw DeadlockError immediately
  await assert.rejects(
    () => lockPaths({ root: dir, owner: 'B', paths: ['package.json'], wait: '10s' }),
    /Deadlock detected: B -> A -> B/
  );

  // A is still waiting, release B so A can finish
  await unlockOwner(dir, 'B');
  await pA;
});

