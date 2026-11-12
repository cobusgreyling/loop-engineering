/**
 * Integration tests for legacy starter deprecation warnings (ticket 07).
 *
 * Verifies that using the legacy tool-enum path (--tool claude|grok|codex|opencode)
 * emits a deprecation warning to stderr while still producing correct scaffold output.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');

// ─── Deprecation warning appears on stderr ─────────────────────────────────────

test('[deprecation] legacy --tool claude emits deprecation warning to stderr', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-claude-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude',
    ]);
    // Warning must appear on stderr
    assert.match(stderr, /deprecated/i, 'stderr should contain deprecation warning');
    assert.match(stderr, /starters\//, 'warning should name the deprecated starters/ path');
    assert.match(stderr, /manifest/i, 'warning should mention manifest-based approach');
    // Output must still be correct
    assert.match(stdout, /daily-triage → .* \(claude\)/);
    await access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[deprecation] legacy --tool grok emits deprecation warning to stderr', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-grok-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok',
    ]);
    assert.match(stderr, /deprecated/i);
    assert.match(stderr, /starters\//);
    assert.match(stderr, /manifest/i);
    assert.match(stdout, /daily-triage → .* \(grok\)/);
    await access(path.join(dir, '.grok', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[deprecation] legacy --tool codex emits deprecation warning to stderr', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-codex-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'codex',
    ]);
    assert.match(stderr, /deprecated/i);
    assert.match(stderr, /starters\//);
    assert.match(stderr, /manifest/i);
    assert.match(stdout, /daily-triage → .* \(codex\)/);
    await access(path.join(dir, '.codex', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[deprecation] legacy --tool opencode emits deprecation warning to stderr', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-opencode-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'opencode',
    ]);
    assert.match(stderr, /deprecated/i);
    assert.match(stderr, /starters\//);
    assert.match(stderr, /manifest/i);
    assert.match(stdout, /daily-triage → .* \(opencode\)/);
    await access(path.join(dir, 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Scaffold output is unchanged despite warning ──────────────────────────────

test('[deprecation] legacy path produces identical files regardless of warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-output-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'pr-babysitter', '--tool', 'claude']);
    // Core scaffold files must still exist (pr-babysitter uses pr-review-triage skill)
    await access(path.join(dir, '.claude', 'skills', 'pr-review-triage', 'SKILL.md'));
    await access(path.join(dir, 'LOOP.md'));
    await access(path.join(dir, 'pr-babysitter-state.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Dry-run also emits the warning ────────────────────────────────────────────

test('[deprecation] legacy --dry-run still emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'deprecation-dryrun-'));
  try {
    const { stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude', '--dry-run',
    ]);
    assert.match(stderr, /deprecated/i);
    assert.match(stderr, /starters\//);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
