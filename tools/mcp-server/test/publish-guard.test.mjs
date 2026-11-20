import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const guard = join(packageRoot, 'scripts/check-publish-manifest.mjs');

async function manifestFixture(t, dependencies) {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-manifest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'x', version: '1.2.0', dependencies }, null, 2) + '\n');
  return directory;
}

const guardIn = cwd => spawnSync(process.execPath, [guard], { cwd, encoding: 'utf8', timeout: 10_000 });

test('a manifest that links the repo cannot be published', async t => {
  const cwd = await manifestFixture(t, {
    '@cobusgreyling/loop-gate': 'file:../loop-gate',
    '@cobusgreyling/loop-cost': '^1.2.0',
    '@modelcontextprotocol/sdk': '^1.12.1',
  });
  const result = guardIn(cwd);
  assert.equal(result.status, 1);
  // The refusal names what has to change, so the next person does not have to hunt.
  assert.match(result.stderr, /@cobusgreyling\/loop-gate: file:\.\.\/loop-gate/);
  assert.doesNotMatch(result.stderr, /loop-cost/);
});

test('the published dependency versions pass', async t => {
  const cwd = await manifestFixture(t, {
    '@cobusgreyling/loop-audit': '^1.9.0',
    '@cobusgreyling/loop-gate': '^1.0.0',
    '@modelcontextprotocol/sdk': '^1.12.1',
  });
  const result = guardIn(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('the package is wired to the guard, and its own manifest would be refused as published', async () => {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  assert.match(manifest.scripts.prepublishOnly, /check-publish-manifest\.mjs/);
  // The development manifest still links the sibling tools, which is why the guard
  // has to stand between it and the registry.
  const linked = Object.values(manifest.dependencies ?? {}).filter(spec => String(spec).startsWith('file:'));
  assert.ok(linked.length > 0);
});
