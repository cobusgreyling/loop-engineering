/**
 * Integration tests for legacy tool name alias resolution and deprecation warnings.
 *
 * Verifies that using legacy tool names (--tool claude|grok|codex|opencode)
 * resolves through the harness manifest alias system, produces correct
 * scaffold output, AND emits a deprecation warning to stderr when a legacy
 * alias is used (not when a canonical harness ID or non-legacy alias is used).
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

// ─── Legacy tool names resolve via aliases WITH deprecation warnings ─────────────

test('[alias] --tool claude resolves through manifest alias and emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-claude-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude',
    ]);
    // Deprecation warning SHOULD appear for legacy alias 'claude'
    assert.match(stderr, /legacy alias/i, 'stderr should contain deprecation warning for legacy alias');
    assert.doesNotMatch(stderr, /starters\//, 'stderr should NOT reference legacy starters/ path');
    // Output must still be correct via manifest-driven path
    assert.match(stdout, /daily-triage → .* \(Claude Code\)/);
    await access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[alias] --tool grok resolves through manifest alias and emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-grok-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok',
    ]);
    assert.match(stderr, /legacy alias/i, 'stderr should contain deprecation warning for legacy alias');
    assert.match(stdout, /daily-triage → .* \(Grok\)/);
    await access(path.join(dir, '.grok', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[alias] --tool codex resolves through manifest alias and emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-codex-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'codex',
    ]);
    assert.match(stderr, /legacy alias/i, 'stderr should contain deprecation warning for legacy alias');
    assert.match(stdout, /daily-triage → .* \(OpenAI Codex\)/);
    await access(path.join(dir, '.codex', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[alias] --tool opencode resolves through manifest alias and emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-opencode-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'opencode',
    ]);
    assert.match(stderr, /legacy alias/i, 'stderr should contain deprecation warning for legacy alias');
    assert.match(stdout, /daily-triage → .* \(OpenCode\)/);
    await access(path.join(dir, 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Scaffold output is correct via manifest-driven path ────────────────────────

test('[alias] manifest path produces correct files for pr-babysitter + claude', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-output-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'pr-babysitter', '--tool', 'claude']);
    // Core scaffold files must exist
    await access(path.join(dir, '.claude', 'skills', 'pr-review-triage', 'SKILL.md'));
    await access(path.join(dir, 'LOOP.md'));
    await access(path.join(dir, 'pr-babysitter-state.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Dry-run also emits deprecation warning for legacy aliases ───────────────────

test('[alias] --dry-run with legacy tool name emits deprecation warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-dryrun-'));
  try {
    const { stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude', '--dry-run',
    ]);
    assert.match(stderr, /legacy alias/i, 'stderr should contain deprecation warning even in dry-run');
    assert.doesNotMatch(stderr, /starters\//);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Non-legacy aliases do NOT emit deprecation warnings ────────────────────────

test('[alias] --tool claude-code resolves as non-legacy alias (no deprecation warning)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-claude-code-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude-code',
    ]);
    // claude-code is a non-legacy alias, so no deprecation warning
    assert.doesNotMatch(stderr, /legacy alias/i, 'non-legacy alias should NOT trigger deprecation warning');
    assert.match(stdout, /daily-triage → .* \(Claude Code\)/);
    await access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[alias] --tool openai-codex resolves as non-legacy alias (no deprecation warning)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'alias-openai-codex-'));
  try {
    const { stdout, stderr } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'openai-codex',
    ]);
    // openai-codex is a non-legacy alias, so no deprecation warning
    assert.doesNotMatch(stderr, /legacy alias/i, 'non-legacy alias should NOT trigger deprecation warning');
    assert.match(stdout, /daily-triage → .* \(OpenAI Codex\)/);
    await access(path.join(dir, '.codex', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
