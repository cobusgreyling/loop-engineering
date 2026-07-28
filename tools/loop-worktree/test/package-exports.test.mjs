import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

async function runNpm(args, options) {
  assert.ok(npmCli, 'package export tests must be run through npm');
  return run(process.execPath, [npmCli, ...args], options);
}

async function withTempDir(callback) {
  const temp = await mkdtemp(path.join(tmpdir(), 'loop-worktree-package-'));
  try {
    return await callback(temp);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

test('packed package exposes the public lock subpath and keeps legacy deep imports', async () => withTempDir(async (temp) => {
  const npmCache = path.join(temp, 'npm-cache');

  const { stdout } = await runNpm(
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--cache',
      npmCache,
      '--pack-destination',
      temp,
    ],
    { cwd: packageRoot, maxBuffer: 10 * 1024 * 1024 },
  );
  const packed = JSON.parse(stdout);
  assert.equal(packed.length, 1);
  assert.ok(
    packed[0].files.some((file) => file.path === 'dist/lock.d.ts'),
    'packed lock subpath should include its declarations',
  );

  const consumer = path.join(temp, 'consumer');
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
  );
  await runNpm(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      npmCache,
      path.join(temp, packed[0].filename),
    ],
    { cwd: consumer, maxBuffer: 10 * 1024 * 1024 },
  );

  const probe = `
    import { createWorktree } from '@cobusgreyling/loop-worktree';
    import {
      LOCKS_DIR,
      lockPaths as publicLockPaths,
    } from '@cobusgreyling/loop-worktree/lock';
    import {
      lockPaths as legacyLockPaths,
    } from '@cobusgreyling/loop-worktree/dist/lock.js';

    if (typeof createWorktree !== 'function') throw new Error('root export missing');
    if (typeof publicLockPaths !== 'function') throw new Error('public lock export missing');
    if (publicLockPaths !== legacyLockPaths) throw new Error('public and legacy exports diverged');
    if (LOCKS_DIR !== '.loop-worktrees/locks') throw new Error('lock constants missing');
  `;
  const probeFile = path.join(consumer, 'probe.mjs');
  await writeFile(probeFile, probe);
  await run(process.execPath, [probeFile], {
    cwd: consumer,
    maxBuffer: 10 * 1024 * 1024,
  });

  const typeProbeFile = path.join(consumer, 'probe.ts');
  await writeFile(
    typeProbeFile,
    `
      import type { LockPathsInput } from '@cobusgreyling/loop-worktree/lock';

      const input: LockPathsInput = {
        root: '.',
        owner: 'consumer',
        paths: ['src/**'],
      };
      void input;
    `,
  );
  await run(
    process.execPath,
    [
      path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      typeProbeFile,
    ],
    { cwd: consumer, maxBuffer: 10 * 1024 * 1024 },
  );
  await run(
    process.execPath,
    [
      path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'ES2020',
      '--moduleResolution',
      'Node',
      '--target',
      'ES2020',
      typeProbeFile,
    ],
    { cwd: consumer, maxBuffer: 10 * 1024 * 1024 },
  );
}));
