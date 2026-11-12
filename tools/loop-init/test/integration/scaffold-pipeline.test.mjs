/**
 * Integration tests for the manifest-driven scaffold pipeline (ticket 05).
 *
 * Tests the expand phase: new harness-ID path coexists with legacy tool-enum path.
 * Uses real CLI invocations against temp directories.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');

// ─── Legacy backward compatibility ────────────────────────────────────────────

test('[scaffold] legacy --tool claude still produces .claude/skills/', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-legacy-claude-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude']);
    assert.match(stdout, /daily-triage → .* \(claude\)/);
    await access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[scaffold] legacy --tool grok still produces .grok/skills/', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-legacy-grok-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    assert.match(stdout, /daily-triage → .* \(grok\)/);
    await access(path.join(dir, '.grok', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[scaffold] legacy --tool codex still produces .codex/skills/', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-legacy-codex-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'codex']);
    assert.match(stdout, /daily-triage → .* \(codex\)/);
    await access(path.join(dir, '.codex', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('[scaffold] legacy --tool opencode still produces skills/', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-legacy-opencode-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'opencode']);
    assert.match(stdout, /daily-triage → .* \(opencode\)/);
    await access(path.join(dir, 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── New manifest-driven path via alias resolution ────────────────────────────

test('[scaffold] --tool claude resolves through alias to harness manifest and scaffolds correctly', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-alias-claude-'));
  try {
    // Using the alias "claude-code" which should resolve to the claude harness
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude-code']);
    assert.match(stdout, /daily-triage/);
    // Should produce claude-style output since claude-code is an alias for claude harness
    await access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Capability fail-fast ─────────────────────────────────────────────────────

test('[scaffold] unknown harness ID fails with clear error message', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-unknown-'));
  try {
    const result = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'nonexistent-harness']);
    // Should have exited non-zero
    assert.fail('Expected non-zero exit code');
  } catch (err) {
    assert.ok(err.stderr || err.stdout);
    const output = (err.stderr || err.stdout || '').toString();
    assert.match(output, /no harness found|Unknown tool|nonexistent-harness/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Manifest-driven scaffold with content directory ──────────────────────────

test('[scaffold] manifest-driven path writes files per harness layout', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-manifest-'));
  try {
    // Use a harness ID directly (not just an alias) — "grok" is both an alias and a harness ID
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    assert.match(stdout, /daily-triage/);
    // Grok layout: .grok/skills/<name>/SKILL.md
    await access(path.join(dir, '.grok', 'skills', 'loop-triage', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─── Dry-run with new path ────────────────────────────────────────────────────

test('[scaffold] manifest-driven dry-run prints would-write without creating files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scaffold-dryrun-'));
  try {
    const { stdout } = await exec('node', [
      CLI, dir, '--pattern', 'daily-triage', '--tool', 'claude', '--dry-run',
    ]);
    assert.match(stdout, /would copy|would write|dry-run/i);
    // Should NOT have created actual files in dry-run
    await assert.rejects(
      () => access(path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md')),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
