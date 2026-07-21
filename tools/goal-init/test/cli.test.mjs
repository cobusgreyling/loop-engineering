import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');
const testDir = path.join(process.cwd(), '.test-tmp');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function setupTestDir() {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(testDir, { recursive: true });
}

async function cleanupTestDir() {
  await rm(testDir, { recursive: true, force: true });
}

describe('goal-init cli', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  test('scaffolds goal configuration correctly', async () => {
    const { stdout } = await exec('node', [CLI, testDir, '--tool', 'grok']);
    
    // Check files exist
    assert.ok(await exists(path.join(testDir, 'GOAL.md')));
    assert.ok(await exists(path.join(testDir, 'goal-budget.md')));
    assert.ok(await exists(path.join(testDir, 'goal-run-log.md')));
    assert.ok(await exists(path.join(testDir, '.grok', 'skills', 'goal-verifier', 'SKILL.md')));
    assert.ok(await exists(path.join(testDir, '.grok', 'skills', 'goal-scoper', 'SKILL.md')));
    assert.ok(await exists(path.join(testDir, 'AGENTS.md')));

    // Match live audit ("Goal Ready:") or fallback ("Goal Ready score")
    assert.match(stdout, /Goal Ready/);
  });

  test('appends to existing AGENTS.md', async () => {
    // Create an empty AGENTS.md first
    const fs = await import('node:fs/promises');
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '# Existing rules\n');

    await exec('node', [CLI, testDir, '--tool', 'grok']);
    
    const content = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8');
    assert.match(content, /Existing rules/);
    assert.match(content, /Goal Engineering Rules/);
  });

  test('does not overwrite existing GOAL.md', async () => {
    const fs = await import('node:fs/promises');
    await fs.writeFile(path.join(testDir, 'GOAL.md'), '# Original Goal\n');

    await exec('node', [CLI, testDir, '--tool', 'grok']);
    
    const content = await fs.readFile(path.join(testDir, 'GOAL.md'), 'utf8');
    assert.equal(content, '# Original Goal\n');
  });

  test('fails on unknown tool', async () => {
    try {
      await exec('node', [CLI, testDir, '--tool', 'invalid-tool']);
      assert.fail('Should have failed');
    } catch (err) {
      assert.match(err.stderr, /Unknown tool: invalid-tool/);
    }
  });

  test('dry-run does not write files', async () => {
    const { stdout } = await exec('node', [CLI, testDir, '--tool', 'grok', '--dry-run']);
    assert.match(stdout, /would copy:/);
    
    // Check files DO NOT exist
    assert.ok(!(await exists(path.join(testDir, 'GOAL.md'))));
    assert.ok(!(await exists(path.join(testDir, 'goal-budget.md'))));
  });
});
