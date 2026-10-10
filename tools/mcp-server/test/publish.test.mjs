import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'package');
  await cp(packageRoot, cwd, {
    recursive: true,
    filter: source => !['node_modules', 'test'].includes(basename(source)) && !source.endsWith('.tgz'),
  });
  const destination = join(directory, 'artifacts');
  await mkdir(destination);
  const original = await readFile(join(cwd, 'package.json'), 'utf8');
  return { cwd, destination, original };
}

function pack(cwd, destination) {
  return spawnSync('npm', ['run', '--silent', 'pack:publish', '--', '--pack-destination', destination], {
    cwd, encoding: 'utf8', timeout: 30_000,
  });
}

test('publication tarball uses public sibling versions and preserves the development manifest', async t => {
  const { cwd, destination, original } = await fixture(t);
  const result = pack(cwd, destination);
  assert.equal(result.status, 0, result.stderr);
  const [artifact] = JSON.parse(result.stdout);
  const unpacked = spawnSync('tar', ['-xOf', join(destination, artifact.filename), 'package/package.json'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  const expected = JSON.parse(original);
  Object.assign(expected.dependencies, {
    '@cobusgreyling/loop-audit': '^1.9.0',
    '@cobusgreyling/loop-context': '^1.5.0',
    '@cobusgreyling/loop-cost': '^1.2.0',
    '@cobusgreyling/loop-gate': '^1.0.0',
  });
  assert.deepEqual(JSON.parse(unpacked.stdout), expected);
  assert.ok(artifact.files.some(file => file.path === 'dist/index.js'));
  assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), original);
});

test('a failed pack reports failure and restores the development manifest', async t => {
  const { cwd, destination, original } = await fixture(t);
  const result = pack(cwd, join(destination, 'missing'));
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /ENOENT/);
  assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), original);
});
