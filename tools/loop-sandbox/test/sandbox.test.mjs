import test from 'node:test';
import assert from 'node:assert';
import { runInSandbox, listPatches } from '../dist/sandbox.js';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdir, rm, writeFile, stat, readFile, readdir } from 'node:fs/promises';
import { execSync, spawn } from 'node:child_process';
import { createWorktree } from '@cobusgreyling/loop-worktree';
import { lockPaths, listLocks } from '@cobusgreyling/loop-worktree/lock';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sandboxDistUrl = pathToFileURL(path.join(testDir, '../dist/sandbox.js')).href;

/** Captures console.log lines produced while `fn` runs, restoring console.log afterward even if fn throws. */
async function captureLogs(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

async function setupTestRepo() {
  const dir = path.join(tmpdir(), `sandbox-test-${Date.now()}-${Math.floor(Math.random()*1000)}`);
  await mkdir(dir, { recursive: true });
  execSync('git init -b main', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  execSync('git config user.email "test@example.com"', { cwd: dir });
  await writeFile(path.join(dir, 'README.md'), '# Test repo');
  execSync('git add README.md', { cwd: dir });
  execSync('git commit -m "init"', { cwd: dir });
  return dir;
}

test('sandbox run captures patch and cleans up', async () => {
  const root = await setupTestRepo();
  const scriptPath = path.join(root, 'test-script.js');
  await writeFile(scriptPath, 'require("fs").writeFileSync("new-file.txt", "hello sandbox");');
  try {
    const result = await runInSandbox(root, 'node', [scriptPath]);
    
    assert.ok(result.hasChanges);
    assert.ok(result.patchFile);
    assert.equal(result.exitCode, 0);

    const patchStat = await stat(result.patchFile);
    assert.ok(patchStat.size > 0);

    await assert.rejects(stat(path.join(root, 'new-file.txt')));

    const patches = await listPatches(root);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].patchPath, result.patchFile);

  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('cleanup is scoped and leaves other active worktrees alone', async () => {
  const root = await setupTestRepo();
  try {
    // Pre-create an active worktree via loop-worktree API
    const other = await createWorktree({ root, runId: 'other-run', pattern: 'test', base: 'main' });
    const otherPathAbs = path.join(root, other.path);
    await stat(otherPathAbs); // verifies it exists
    
    // Run sandbox
    const result = await runInSandbox(root, 'node', ['-e', 'require("fs").writeFileSync("foo.txt", "bar");']);
    assert.ok(result.hasChanges);
    
    // Verify the other worktree STILL exists
    await stat(otherPathAbs);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('extract failure prevents cleanup to avoid data loss', async () => {
  const root = await setupTestRepo();
  try {
    // Sabotage git by deleting the worktree's metadata inside the parent repo.
    // This makes git add -A fail because the worktree is completely broken.
    const result = await runInSandbox(root, 'node', [
      '-e', 
      'const fs = require("fs"); const gitdir = fs.readFileSync(".git", "utf8").trim().replace("gitdir: ", ""); fs.rmSync(gitdir, {recursive: true, force: true});'
    ]);
    
    assert.equal(result.hasChanges, false);
    
    // The worktree branch and directory should still be on disk
    const statObj = await stat(path.join(root, '.loop-worktrees', result.runId));
    assert.ok(statObj.isDirectory(), 'worktree should remain on disk');
    
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('binary patch captures exactly without utf8 corruption', async () => {
  const root = await setupTestRepo();
  try {
    // Write a binary sequence
    const scriptPath = path.join(root, 'binary-script.js');
    await writeFile(scriptPath, 'require("fs").writeFileSync("binary.bin", Buffer.from([0x00, 0xFF, 0xFE, 0xFD]));');
    
    const result = await runInSandbox(root, 'node', [scriptPath]);
    assert.ok(result.hasChanges);
    
    const patchContent = await readFile(result.patchFile);
    assert.ok(patchContent.toString('ascii').includes('GIT binary patch'));
    
    // Apply the patch to the main repo
    execSync(`git apply ${result.patchFile}`, { cwd: root });
    
    // Verify exact bytes
    const appliedContent = await readFile(path.join(root, 'binary.bin'));
    assert.equal(appliedContent[0], 0x00);
    assert.equal(appliedContent[1], 0xFF);
    assert.equal(appliedContent[2], 0xFE);
    assert.equal(appliedContent[3], 0xFD);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('lockPaths option holds and releases a loop-worktree lock around the run', async () => {
  const root = await setupTestRepo();
  try {
    let result;
    const logs = await captureLogs(async () => {
      result = await runInSandbox(root, 'node', ['-e', 'require("fs").writeFileSync("locked.txt", "x");'], {
        lockPaths: ['src/**'],
        lockOwner: 'lock-test-owner',
      });
    });
    assert.ok(result.hasChanges);

    // The lock must be released once the run completes -- otherwise it would
    // strand future loops out of src/** indefinitely with no TTL set.
    const locks = await listLocks(root);
    assert.equal(locks.length, 0);

    // A lock was actually acquired and released here, so the release message
    // must be printed -- this is the positive case for the "don't claim a
    // release that didn't happen" fix below.
    assert.ok(
      logs.some((l) => l.includes('Released lock held by "lock-test-owner"')),
      `expected a release message when a lock actually was released, got: ${JSON.stringify(logs)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('lockPaths option refuses to run when another owner holds an overlapping lock', async () => {
  const root = await setupTestRepo();
  try {
    await lockPaths({ root, owner: 'other-loop', paths: ['src/**'] });

    const logs = await captureLogs(async () => {
      await assert.rejects(
        runInSandbox(root, 'node', ['-e', 'require("fs").writeFileSync("should-not-run.txt", "x");'], {
          lockPaths: ['src/nested/**'],
          lockOwner: 'sandbox-test-owner',
        }),
        /locked by owner "other-loop"/,
      );
    });

    // Blocked before the worktree was ever created -- nothing to clean up.
    const worktreeList = execSync('git worktree list --porcelain', { cwd: root, encoding: 'utf8' });
    assert.equal(worktreeList.match(/^worktree /gm)?.length, 1, 'only the main worktree should exist');
    // The other loop's lock is untouched by the rejected attempt.
    const locks = await listLocks(root);
    assert.equal(locks.length, 1);
    assert.equal(locks[0].owner, 'other-loop');

    // lockPaths() never acquired anything for "sandbox-test-owner" here (it
    // threw before writing a lock file), so cleanup() must not claim it
    // released a lock that was never held.
    assert.ok(
      !logs.some((l) => /Releasing lock|Released lock/.test(l)),
      `must not print a lock-release message when no lock was ever acquired, got: ${JSON.stringify(logs)}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('lockPaths option holds the lock while the run is still in progress, not just after', async () => {
  const root = await setupTestRepo();
  try {
    const startedMarker = path.join(root, 'started.txt');
    const goMarker = path.join(root, 'go.txt');

    const runPromise = runInSandbox(root, 'node', [
      '-e',
      `require("fs").writeFileSync(${JSON.stringify(startedMarker)}, "x");` +
        `const iv = setInterval(() => { if (require("fs").existsSync(${JSON.stringify(goMarker)})) { clearInterval(iv); process.exit(0); } }, 50);`,
    ], { lockPaths: ['src/**'], lockOwner: 'midrun-owner' });

    while (!(await stat(startedMarker).catch(() => null))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // The lock must be visible while the sandboxed command is still running,
    // not only after runInSandbox() resolves.
    const locksMidRun = await listLocks(root);
    assert.equal(locksMidRun.length, 1);
    assert.equal(locksMidRun[0].owner, 'midrun-owner');

    await writeFile(goMarker, 'go');
    await runPromise;

    const locksAfter = await listLocks(root);
    assert.equal(locksAfter.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('lock is released even when patch extraction fails and the worktree is left behind', async () => {
  const root = await setupTestRepo();
  try {
    const result = await runInSandbox(root, 'node', [
      '-e',
      'const fs = require("fs"); const gitdir = fs.readFileSync(".git", "utf8").trim().replace("gitdir: ", ""); fs.rmSync(gitdir, {recursive: true, force: true});',
    ], { lockPaths: ['src/**'], lockOwner: 'extract-fail-owner' });

    assert.equal(result.hasChanges, false);

    // The worktree is deliberately left on disk for manual recovery when
    // extraction fails...
    const statObj = await stat(path.join(root, '.loop-worktrees', result.runId));
    assert.ok(statObj.isDirectory(), 'worktree should remain on disk');

    // ...but lock release has nothing to do with whether patch extraction
    // succeeded, so it must still happen.
    const locks = await listLocks(root);
    assert.equal(locks.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('a second SIGINT while cleanup is in flight does not exit before the lock is released', async () => {
  const root = await setupTestRepo();
  try {
    // Same self-emitting-SIGINT approach as the test above, but fires SIGINT
    // twice in quick succession. The bug this guards against: the first cut
    // re-ran cleanup() on every signal and let a boolean guard turn repeat
    // calls into instant no-ops, so the *second* signal's
    // `.finally(() => process.exit(1))` could fire before the *first*
    // signal's cleanup (lock release, worktree removal) ever finished.
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      const mod = await import(${JSON.stringify(sandboxDistUrl)});
      mod.runInSandbox(${JSON.stringify(root)}, 'node', ['-e', 'setInterval(() => {}, 1000)'], {
        lockPaths: ['src/**'],
        lockOwner: 'double-sigint-owner',
      }).catch(() => {});
      setTimeout(() => process.emit('SIGINT'), 1000);
      setTimeout(() => process.emit('SIGINT'), 1030);
    `], { stdio: 'ignore' });

    const exited = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      child.on('exit', () => { clearTimeout(timer); resolve(true); });
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
    if (!exited) {
      child.kill('SIGKILL');
      assert.fail('child did not exit after a double synthetic SIGINT within 10s -- the lock is likely stranded');
    }

    const locks = await listLocks(root);
    assert.equal(locks.length, 0, 'a second SIGINT during cleanup must not exit before the lock is released');

    // The lock release itself is a fast fs.unlink and tends to finish inside
    // the race window regardless of this bug -- the sharper signal is
    // whether the *slower* worktree teardown (spawns `git worktree remove`)
    // also got to finish. Under the old guard-based cleanup, the second
    // signal's process.exit() could cut that off mid-flight and leave a
    // `sandbox-*` directory behind under .loop-worktrees (confirmed by
    // reproducing this against the pre-fix code before writing this test).
    const worktreeEntries = await readdir(path.join(root, '.loop-worktrees')).catch(() => []);
    assert.ok(
      !worktreeEntries.some((name) => name.startsWith('sandbox-')),
      `worktree cleanup must finish even under a double signal, found: ${worktreeEntries.join(', ')}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test('SIGINT mid-run releases the lock instead of stranding it', async () => {
  const root = await setupTestRepo();
  try {
    // Run in a dedicated child process and self-trigger SIGINT via
    // process.emit from inside it -- real OS signal delivery to a spawned
    // process is unreliable to script from a test (especially on Windows),
    // but process.emit('SIGINT') exercises the exact same registered
    // listener a real signal would, without that flakiness. The sandboxed
    // "user command" (setInterval) never exits on its own, so this also
    // covers cleanup() running while the child it's meant to clean up after
    // is still alive.
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      const mod = await import(${JSON.stringify(sandboxDistUrl)});
      mod.runInSandbox(${JSON.stringify(root)}, 'node', ['-e', 'setInterval(() => {}, 1000)'], {
        lockPaths: ['src/**'],
        lockOwner: 'sigint-test-owner',
      }).catch(() => {});
      setTimeout(() => process.emit('SIGINT'), 1000);
    `], { stdio: 'ignore' });

    const exited = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      child.on('exit', () => { clearTimeout(timer); resolve(true); });
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
    if (!exited) {
      child.kill('SIGKILL');
      assert.fail('child did not exit after synthetic SIGINT within 10s -- the lock is likely stranded');
    }

    const locks = await listLocks(root);
    assert.equal(locks.length, 0, 'lock must be released after SIGINT, not left stranded with no TTL');
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
