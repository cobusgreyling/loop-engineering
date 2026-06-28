import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');

test('bundle-assets tolerates concurrent rebuilds', async () => {
  await Promise.all([
    exec('node', ['scripts/bundle-assets.mjs']),
    exec('node', ['scripts/bundle-assets.mjs']),
  ]);
  await access(path.join('starters', 'issue-triage', 'README.md'));
  await access(path.join('templates', 'SKILL.md.issue-triage'));
  await access('registry.yaml');
});

test('loop-init --help exits 0', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /changelog-drafter/);
});

test('loop-init dry-run scaffolds daily-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
      '--dry-run',
    ]);
    assert.match(stdout, /loop-init: daily-triage/);
    assert.match(stdout, /would copy|copied/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds issue-triage with bundled assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'issue-triage', '--tool', 'grok']);
    await access(path.join(dir, 'issue-triage-state.md'));
    await access(path.join(dir, '.grok', 'skills', 'issue-triage', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'));
    await access(path.join(dir, 'loop-budget.md'));
    await access(path.join(dir, 'loop-run-log.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init rejects unknown pattern', async () => {
  await assert.rejects(
    () => exec('node', [CLI, '.', '--pattern', 'not-a-pattern', '--tool', 'grok', '--dry-run']),
    (err) => err.stderr?.includes('Unknown pattern') || err.message?.includes('Unknown pattern'),
  );
});

test('loop-init rejects unknown tool', async () => {
  await assert.rejects(
    () => exec('node', [CLI, '.', '--pattern', 'daily-triage', '--tool', 'emacs', '--dry-run']),
    (err) => err.stderr?.includes('Unknown tool') || err.message?.includes('Unknown tool'),
  );
});

test('loop-init scaffolds ci-sweeper with bundled assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'ci-sweeper', '--tool', 'grok']);
    await access(path.join(dir, 'ci-sweeper-state.md'));
    await access(path.join(dir, '.grok', 'skills', 'ci-triage', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'minimal-fix', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'));
    await access(path.join(dir, 'loop-budget.md'));
    await access(path.join(dir, 'loop-run-log.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-budget', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
