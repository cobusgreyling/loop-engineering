import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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
  // npm may print notices before JSON, and newer npm may return a single object.
  const jsonStart = (() => {
    const arr = stdout.indexOf('[');
    const obj = stdout.indexOf('{');
    if (arr === -1) return obj;
    if (obj === -1) return arr;
    return Math.min(arr, obj);
  })();
  assert.ok(jsonStart >= 0, `npm pack --json produced no JSON: ${stdout.slice(0, 200)}`);
  const parsed = JSON.parse(stdout.slice(jsonStart));
  const packed = Array.isArray(parsed) ? parsed : [parsed];
  assert.equal(packed.length, 1, `unexpected pack json: ${stdout.slice(0, 500)}`);
  // Resolve tarball path: prefer pack metadata, fall back to scanning pack-destination.
  const metaName = packed[0]?.filename || packed[0]?.name;
  let tarball = metaName ? path.join(temp, path.basename(String(metaName))) : null;
  const tempEntries = await readdir(temp);
  if (!tarball || !tempEntries.includes(path.basename(tarball))) {
    const tgzs = tempEntries.filter((f) => f.endsWith('.tgz'));
    assert.equal(
      tgzs.length,
      1,
      `expected one tarball in pack-destination, got: ${tgzs.join(', ') || '(none)'}; pack stdout: ${stdout.slice(0, 500)}`,
    );
    tarball = path.join(temp, tgzs[0]);
  }
  // Prefer files[] when present; otherwise inspect the tarball (npm@latest may omit files).
  if (Array.isArray(packed[0]?.files)) {
    assert.ok(
      packed[0].files.some((file) => file.path === 'dist/lock.d.ts'),
      'packed lock subpath should include its declarations',
    );
  } else {
    const { stdout: tarList } = await run('tar', ['-tzf', tarball], {
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.ok(
      tarList.split('\n').some((line) => line.endsWith('dist/lock.d.ts')),
      `tarball missing dist/lock.d.ts; listing:\n${tarList}`,
    );
  }

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
      tarball,
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
