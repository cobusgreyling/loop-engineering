import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const { loadPatternManifest } = await import('../../dist/pattern/loader.js');

/** Base patterns that should have manifest files (not tool-specific variants). */
const BASE_PATTERNS = [
  'changelog-drafter',
  'ci-sweeper',
  'dependency-sweeper',
  'issue-triage',
  'minimal-loop',
  'post-merge-cleanup',
  'pr-babysitter',
  'thin-loop',
];

// Starters live at the repo root, not inside tools/loop-init/
const STARTERS_DIR = path.resolve('../../starters');

test('all base patterns have manifest.yaml files', async () => {
  for (const pattern of BASE_PATTERNS) {
    const manifestPath = path.join(STARTERS_DIR, pattern, 'manifest.yaml');
    const content = await readFile(manifestPath, 'utf-8');
    assert.ok(content.length > 0, `${pattern}/manifest.yaml should not be empty`);
  }
});

test('all base pattern manifests parse successfully', async () => {
  for (const pattern of BASE_PATTERNS) {
    const manifestPath = path.join(STARTERS_DIR, pattern, 'manifest.yaml');
    const manifest = await loadPatternManifest(manifestPath);
    assert.equal(manifest.id, pattern, `manifest id should match directory name for ${pattern}`);
    assert.ok(Array.isArray(manifest.required_capabilities), `${pattern} should have required_capabilities array`);
    assert.ok(manifest.required_capabilities.length >= 3, `${pattern} should have at least the minimum contract capabilities`);
  }
});

test('all base pattern manifests include minimum viable contract', async () => {
  const minimumContract = ['shell', 'file_write', 'skill_read'];
  for (const pattern of BASE_PATTERNS) {
    const manifestPath = path.join(STARTERS_DIR, pattern, 'manifest.yaml');
    const manifest = await loadPatternManifest(manifestPath);
    for (const cap of minimumContract) {
      assert.ok(
        manifest.required_capabilities.includes(cap),
        `${pattern} must require "${cap}" as part of minimum viable contract`
      );
    }
  }
});

test('pr-babysitter requires worktree capability', async () => {
  const manifestPath = path.join(STARTERS_DIR, 'pr-babysitter', 'manifest.yaml');
  const manifest = await loadPatternManifest(manifestPath);
  assert.ok(
    manifest.required_capabilities.includes('worktree'),
    'pr-babysitter should require worktree capability'
  );
});

test('no base pattern manifests emit warnings (no unknown capabilities)', async () => {
  for (const pattern of BASE_PATTERNS) {
    const manifestPath = path.join(STARTERS_DIR, pattern, 'manifest.yaml');
    const manifest = await loadPatternManifest(manifestPath);
    assert.ok(
      !manifest.warnings || manifest.warnings.length === 0,
      `${pattern} manifest should not have warnings about unknown capabilities`
    );
  }
});

test('tool-specific variant directories do NOT have manifest files', async () => {
  const entries = await readdir(STARTERS_DIR, { withFileTypes: true });
  const variantDirs = entries
    .filter((e) => e.isDirectory() && /-(claude|codex|opencode|grok)$/.test(e.name))
    .map((e) => e.name);

  for (const variant of variantDirs) {
    try {
      await readFile(path.join(STARTERS_DIR, variant, 'manifest.yaml'));
      assert.fail(`${variant} should NOT have a manifest.yaml (only base patterns should)`);
    } catch (err) {
      // Expected: file does not exist
      assert.ok(err.code === 'ENOENT', `${variant}/manifest.yaml should not exist`);
    }
  }
});
