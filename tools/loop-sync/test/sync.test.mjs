import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runSync, formatReport, extractFrontmatter, levelForScore } from '../dist/sync.js';

const testDir = path.join(process.cwd(), '.test-tmp');
const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');

async function setupTestDir() {
  await mkdir(testDir, { recursive: true });

  await writeFile(
    path.join(testDir, 'STATE.md'),
    `# Loop State

Last run: 2026-06-22

## High Priority
- No items

## Watch List
- No items
`,
  );

  await writeFile(
    path.join(testDir, 'LOOP.md'),
    `# Loop Configuration

## Patterns
- daily-triage

## State Files
- STATE.md

## Schedule
- Cadence: 1d
- Level: L1
`,
  );
}

async function cleanupTestDir() {
  await rm(testDir, { recursive: true, force: true });
}

const baseOpts = { autoFix: false, dryRun: false, verbose: false };

describe('runSync', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  test('returns a valid DriftReport', async () => {
    const report = await runSync({ targetDir: testDir, ...baseOpts });

    assert.equal(typeof report.score, 'number');
    assert.ok(['healthy', 'warning', 'critical'].includes(report.level));
    assert.ok(Array.isArray(report.issues));
    assert.ok(Array.isArray(report.suggestions));
    assert.ok(report.timestamp);
  });

  test('detects missing AGENTS.md', async () => {
    const report = await runSync({ targetDir: testDir, ...baseOpts });
    const agentsIssue = report.issues.find((i) => i.file === 'AGENTS.md');
    assert.ok(agentsIssue);
    assert.match(agentsIssue.message, /missing/i);
  });

  test('calculates score in range', async () => {
    const report = await runSync({ targetDir: testDir, ...baseOpts });
    assert.ok(report.score >= 0);
    assert.ok(report.score <= 100);
  });

  test('provides suggestions', async () => {
    const report = await runSync({ targetDir: testDir, ...baseOpts });
    assert.ok(report.suggestions.length > 0);
  });
});

describe('runSync auto-fix', () => {
  const fixDir = path.join(process.cwd(), '.test-tmp-autofix');

  beforeEach(() => mkdir(fixDir, { recursive: true }));
  afterEach(() => rm(fixDir, { recursive: true, force: true }));

  test('scaffolds STATE.md, gate.yaml, loop-budget.md, and loop-run-log.md when missing', async () => {
    const report = await runSync({ targetDir: fixDir, autoFix: true, dryRun: false, verbose: false });

    for (const file of ['STATE.md', 'gate.yaml', 'loop-budget.md', 'loop-run-log.md']) {
      const content = await readFile(path.join(fixDir, file), 'utf8');
      assert.ok(content.length > 0, `${file} should have been scaffolded with content`);
      const issue = report.issues.find((i) => i.file === file);
      assert.equal(issue.severity, 'info');
      assert.match(issue.message, /scaffolded/i);
    }
    // loop-run-log.md must keep the marker append-run-log.mjs depends on.
    const runLog = await readFile(path.join(fixDir, 'loop-run-log.md'), 'utf8');
    assert.match(runLog, /<!-- Loop appends below this line -->/);

    // A bare pattern like ".env" only matches a path exactly equal to
    // ".env" under minimatch (tools/loop-gate's matcher) -- it silently
    // misses "services/api/.env". Every denylist entry must be
    // **/-anchored (or already contain its own ** segment) so the
    // scaffolded policy actually catches a nested match too.
    const gateYaml = await readFile(path.join(fixDir, 'gate.yaml'), 'utf8');
    const denylistBlock = gateYaml.match(/denylist:\n((?:\s+-\s+.+\n)+)/)?.[1] ?? '';
    const entries = [...denylistBlock.matchAll(/-\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(entries.length > 0, 'expected at least one denylist entry to check');
    for (const entry of entries) {
      assert.ok(
        entry.startsWith('**/') || entry.includes('**'),
        `denylist entry "${entry}" is not anchored and would miss a nested match`,
      );
    }
  });

  test('does not fabricate LOOP.md or AGENTS.md -- still reported as missing', async () => {
    const report = await runSync({ targetDir: fixDir, autoFix: true, dryRun: false, verbose: false });

    assert.equal(await fileExists(path.join(fixDir, 'LOOP.md')), false);
    assert.equal(await fileExists(path.join(fixDir, 'AGENTS.md')), false);
    const loopIssue = report.issues.find((i) => i.file === 'LOOP.md');
    assert.equal(loopIssue.severity, 'error');
    assert.match(loopIssue.suggestion, /loop-init/);
  });

  test('--dry-run with --auto-fix reports without writing anything', async () => {
    const report = await runSync({ targetDir: fixDir, autoFix: true, dryRun: true, verbose: false });

    assert.equal(await fileExists(path.join(fixDir, 'STATE.md')), false);
    const issue = report.issues.find((i) => i.file === 'STATE.md');
    assert.match(issue.message, /would scaffold/i);
    assert.match(issue.message, /dry-run/i);
  });

  test('appends a STATE.md reference to LOOP.md when missing', async () => {
    await writeFile(path.join(fixDir, 'STATE.md'), '# Loop State\n');
    await writeFile(
      path.join(fixDir, 'LOOP.md'),
      `# Loop Configuration\n\n## Patterns\n- daily-triage\n`,
    );

    const report = await runSync({ targetDir: fixDir, autoFix: true, dryRun: false, verbose: false });

    const loopContent = await readFile(path.join(fixDir, 'LOOP.md'), 'utf8');
    assert.match(loopContent, /Update STATE\.md after each run\./);
    const issue = report.issues.find((i) => i.file === 'LOOP.md' && i.type === 'inconsistent');
    assert.equal(issue.severity, 'info');
    assert.match(issue.message, /appended a reference/i);
  });
});

function fileExists(p) {
  return access(p).then(() => true, () => false);
}

describe('formatReport', () => {
  test('formats healthy report', () => {
    const formatted = formatReport({
      score: 85,
      level: 'healthy',
      issues: [],
      suggestions: ['Run loop-init'],
      timestamp: new Date().toISOString(),
    });

    assert.match(formatted, /Loop Sync Report/);
    assert.match(formatted, /85\/100/);
  });

  test('shows issues when present', () => {
    const formatted = formatReport({
      score: 60,
      level: 'warning',
      issues: [
        {
          type: 'missing',
          file: 'AGENTS.md',
          message: 'AGENTS.md is missing',
          severity: 'error',
        },
      ],
      suggestions: [],
      timestamp: new Date().toISOString(),
    });

    assert.match(formatted, /AGENTS\.md/);
    assert.match(formatted, /missing/i);
  });
});

describe('extractFrontmatter', () => {
  test('parses LF frontmatter', () => {
    const { frontmatter, body } = extractFrontmatter(
      '---\nkey: value\n---\nbody text\n',
    );
    assert.deepEqual(frontmatter, { key: 'value' });
    assert.equal(body, 'body text\n');
  });

  test('parses CRLF frontmatter without trailing carriage returns', () => {
    const { frontmatter, body } = extractFrontmatter(
      '---\r\nkey: value\r\nother: thing\r\n---\r\nbody text\r\n',
    );
    assert.deepEqual(frontmatter, { key: 'value', other: 'thing' });
    assert.ok(!Object.values(frontmatter).some((v) => v.endsWith('\r')));
    assert.ok(!Object.keys(frontmatter).some((k) => k.endsWith('\r')));
    assert.equal(body, 'body text\r\n');
  });

  test('rejects opening fence without newline (---hello)', () => {
    const { frontmatter } = extractFrontmatter('---hello\nkey: value\n---\n');
    assert.deepEqual(frontmatter, {});
  });

  test('rejects closing fence without preceding newline', () => {
    const { frontmatter } = extractFrontmatter('---\nkey: value\n---oops\n');
    assert.deepEqual(frontmatter, {});
  });

  test('a close fence at end of file leaves an empty body', () => {
    const { frontmatter, body } = extractFrontmatter('---\nkey: value\n---');
    assert.deepEqual(frontmatter, { key: 'value' });
    assert.equal(body, '');
  });

  test('a CRLF close fence at end of file leaves an empty body', () => {
    const { frontmatter, body } = extractFrontmatter('---\r\nkey: value\r\n---');
    assert.deepEqual(frontmatter, { key: 'value' });
    assert.equal(body, '');
  });

  test('an empty block at end of file leaves an empty body', () => {
    const { frontmatter, body } = extractFrontmatter('---\n---');
    assert.deepEqual(frontmatter, {});
    assert.equal(body, '');
  });
});

describe('cli', () => {
  beforeEach(setupTestDir);
  afterEach(cleanupTestDir);

  test('emits JSON when --json is provided', async () => {
    let stdout;
    try {
      ({ stdout } = await exec('node', [CLI, testDir, '--json']));
    } catch (err) {
      stdout = err.stdout;
      assert.equal(err.code, 1);
    }
    const report = JSON.parse(stdout);

    assert.equal(typeof report.score, 'number');
    assert.ok(['healthy', 'warning', 'critical'].includes(report.level));
    assert.ok(Array.isArray(report.issues));
    assert.ok(Array.isArray(report.suggestions));
  });
});

describe('levelForScore', () => {
  // The bands `loop-sync --help` prints: 90-100 healthy, 70-89 warning, 0-69 critical.
  test('grades a score on the scale the CLI publishes', () => {
    assert.equal(levelForScore(100), 'healthy');
    assert.equal(levelForScore(90), 'healthy');
    assert.equal(levelForScore(89), 'warning');
    assert.equal(levelForScore(70), 'warning');
    assert.equal(levelForScore(69), 'critical');
    assert.equal(levelForScore(0), 'critical');
  });

  // A report used to stay healthy down to 70, and one error issue costs 20 points:
  // a single finding could print as healthy and exit 0.
  test('one error issue is a warning, not a healthy report', () => {
    assert.equal(levelForScore(100 - 20), 'warning');
  });
});
