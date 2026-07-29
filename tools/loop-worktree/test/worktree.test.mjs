import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  createWorktree,
  markWorktree,
  cleanupWorktrees,
  gc,
  listWorktrees,
  readManifest,
  isGitRepo,
} from '../dist/worktree.js';

const run = promisify(execFile);

async function git(args, cwd) {
  await run('git', args, { cwd });
}

async function initRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-worktree-'));
  await git(['init', '-b', 'main'], dir);
  await git(['config', 'user.email', 'test@example.com'], dir);
  await git(['config', 'user.name', 'Test'], dir);
  await git(['commit', '--allow-empty', '-m', 'init'], dir);
  return dir;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

test('create records a manifest entry and checks out the worktree', async () => {
  const dir = await initRepo();
  try {
    const entry = await createWorktree({ root: dir, runId: 'run-1', pattern: 'ci-sweeper' });
    assert.equal(entry.status, 'active');
    assert.equal(entry.branch, 'loop/run-1');
    assert.equal(entry.baseBranch, 'main');
    assert.equal(entry.path, '.loop-worktrees/run-1');
    assert.ok(await exists(path.join(dir, '.loop-worktrees', 'run-1')));

    const manifest = await readManifest(dir);
    assert.equal(manifest.version, 1);
    assert.equal(manifest.worktrees.length, 1);
    assert.equal(manifest.worktrees[0].id, 'run-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('create rejects a duplicate active run id', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'dup', pattern: 'ci-sweeper' });
    await assert.rejects(
      () => createWorktree({ root: dir, runId: 'dup', pattern: 'ci-sweeper' }),
      /already has an active worktree/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('create fails cleanly outside a git repo', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-worktree-nogit-'));
  try {
    assert.equal(await isGitRepo(dir), false);
    await assert.rejects(
      () => createWorktree({ root: dir, runId: 'x', pattern: 'ci-sweeper' }),
      /Not a git repository/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('mark updates status; list filters by status', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'a', pattern: 'ci-sweeper' });
    await createWorktree({ root: dir, runId: 'b', pattern: 'pr-babysitter' });
    await markWorktree({ root: dir, runId: 'a', status: 'rejected' });

    const active = await listWorktrees({ root: dir, status: 'active' });
    assert.deepEqual(active.map((w) => w.id), ['b']);
    const rejected = await listWorktrees({ root: dir, status: 'rejected' });
    assert.deepEqual(rejected.map((w) => w.id), ['a']);

    await assert.rejects(
      () => markWorktree({ root: dir, runId: 'missing', status: 'merged' }),
      /No worktree with run id/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cleanup removes rejected/escalated and prunes the manifest (round-trip)', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'keep', pattern: 'ci-sweeper' });
    await createWorktree({ root: dir, runId: 'drop', pattern: 'ci-sweeper' });
    await markWorktree({ root: dir, runId: 'drop', status: 'rejected' });

    const result = await cleanupWorktrees({ root: dir });
    assert.deepEqual(result.removed.map((e) => e.id), ['drop']);
    assert.equal(result.skipped.length, 0);
    assert.equal(await exists(path.join(dir, '.loop-worktrees', 'drop')), false);

    const manifest = await readManifest(dir);
    assert.deepEqual(manifest.worktrees.map((w) => w.id), ['keep']);

    const clean = await gc({ root: dir });
    assert.equal(clean.orphans.length, 0);
    assert.equal(clean.dropped.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cleanup skips a dirty worktree without --force, removes it with --force', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'dirty', pattern: 'ci-sweeper' });
    await markWorktree({ root: dir, runId: 'dirty', status: 'rejected' });
    // Untracked file makes the worktree dirty; git refuses removal without --force.
    await writeFile(path.join(dir, '.loop-worktrees', 'dirty', 'scratch.txt'), 'wip');

    const skip = await cleanupWorktrees({ root: dir });
    assert.equal(skip.removed.length, 0);
    assert.equal(skip.skipped.length, 1);
    assert.equal(skip.skipped[0].entry.id, 'dirty');
    assert.ok(await exists(path.join(dir, '.loop-worktrees', 'dirty')));

    const forced = await cleanupWorktrees({ root: dir, force: true });
    assert.deepEqual(forced.removed.map((e) => e.id), ['dirty']);
    assert.equal(await exists(path.join(dir, '.loop-worktrees', 'dirty')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('gc drops manifest entries whose worktree was removed out of band', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'gone', pattern: 'ci-sweeper' });
    // Remove the worktree behind loop-worktree's back.
    await git(['worktree', 'remove', '--force', '.loop-worktrees/gone'], dir);

    const result = await gc({ root: dir });
    assert.deepEqual(result.dropped.map((e) => e.id), ['gone']);
    const manifest = await readManifest(dir);
    assert.equal(manifest.worktrees.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cleanup honors --older-than', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'fresh', pattern: 'ci-sweeper' });
    await markWorktree({ root: dir, runId: 'fresh', status: 'rejected' });
    // Just created, so a 1h floor should skip it.
    const result = await cleanupWorktrees({ root: dir, olderThan: '1h' });
    assert.equal(result.removed.length, 0);
    assert.ok(await exists(path.join(dir, '.loop-worktrees', 'fresh')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('concurrent creates with different run IDs retain both manifest entries', async () => {
  const dir = await initRepo();
  try {
    const results = await Promise.allSettled([
      createWorktree({ root: dir, runId: 'run-a', pattern: 'ci-sweeper' }),
      createWorktree({ root: dir, runId: 'run-b', pattern: 'ci-sweeper' }),
    ]);

    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');

    const manifest = await readManifest(dir);
    assert.equal(manifest.worktrees.length, 2);
    const ids = manifest.worktrees.map((w) => w.id).sort();
    assert.deepEqual(ids, ['run-a', 'run-b']);

    assert.ok(await exists(path.join(dir, '.loop-worktrees', 'run-a')));
    assert.ok(await exists(path.join(dir, '.loop-worktrees', 'run-b')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('concurrent creates with same run ID produce exactly one success and no orphaned Git worktree', async () => {
  const dir = await initRepo();
  try {
    const results = await Promise.allSettled([
      createWorktree({ root: dir, runId: 'same-id', pattern: 'ci-sweeper' }),
      createWorktree({ root: dir, runId: 'same-id', pattern: 'ci-sweeper' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const manifest = await readManifest(dir);
    assert.equal(manifest.worktrees.length, 1);
    assert.equal(manifest.worktrees[0].id, 'same-id');

    const clean = await gc({ root: dir });
    assert.equal(clean.orphans.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('concurrent create and mark operations do not lose entries or fields', async () => {
  const dir = await initRepo();
  try {
    await createWorktree({ root: dir, runId: 'run-a', pattern: 'ci-sweeper' });
    const results = await Promise.allSettled([
      createWorktree({ root: dir, runId: 'run-b', pattern: 'ci-sweeper' }),
      markWorktree({ root: dir, runId: 'run-a', status: 'rejected' }),
    ]);

    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');

    const manifest = await readManifest(dir);
    assert.equal(manifest.worktrees.length, 2);
    const entryA = manifest.worktrees.find((w) => w.id === 'run-a');
    const entryB = manifest.worktrees.find((w) => w.id === 'run-b');
    assert.equal(entryA.status, 'rejected');
    assert.equal(entryB.status, 'active');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

