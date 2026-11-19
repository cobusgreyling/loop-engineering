import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import {
  extractSafetyDenylist,
  extractGateDenylist,
  comparePolicies,
  findUndocumentedLimits,
  hasDrift,
} from '../dist/policy-drift.js';
import { runSync } from '../dist/sync.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FENCE = '```';

const SAFETY_MD = [
  '# Safety & Guardrails',
  '',
  '## Path Denylist',
  '',
  'The loop must **never** auto-edit these without human approval:',
  '',
  FENCE,
  '**/.env',
  '**/secrets/**',
  '**/migrations/**          # unless explicit migration loop',
  FENCE,
  '',
  '## Auto-Merge Policy',
  '',
].join('\n');

const GATE_YAML = [
  'version: 1',
  '',
  'denylist:',
  '  - "**/.env"',
  '  - "**/secrets/**"',
  '  - "**/migrations/**"',
  '',
  'maxFiles: 10',
  '',
].join('\n');

describe('extractSafetyDenylist', () => {
  test('pulls globs from the Path Denylist fenced block', () => {
    const result = extractSafetyDenylist(SAFETY_MD);
    assert.deepEqual(result.patterns, ['**/.env', '**/secrets/**', '**/migrations/**']);
  });

  test('strips inline comments so annotated entries still compare equal', () => {
    const result = extractSafetyDenylist(SAFETY_MD);
    assert.ok(!result.patterns.some((p) => p.includes('#')));
    assert.ok(result.patterns.includes('**/migrations/**'));
  });

  test('returns null when there is no Path Denylist heading', () => {
    assert.equal(extractSafetyDenylist('# Safety\n\n## Other\n\ntext\n'), null);
  });

  test('returns null when the heading has no code block before the next heading', () => {
    assert.equal(extractSafetyDenylist('## Path Denylist\n\nprose only\n\n## Next\n'), null);
  });

  test('returns null on an unterminated fence rather than guessing', () => {
    assert.equal(extractSafetyDenylist(`## Path Denylist\n\n${FENCE}\n**/.env\n`), null);
  });

  test('parses CRLF markdown', () => {
    const result = extractSafetyDenylist(SAFETY_MD.replace(/\n/g, '\r\n'));
    assert.deepEqual(result.patterns, ['**/.env', '**/secrets/**', '**/migrations/**']);
  });
});

describe('extractGateDenylist', () => {
  test('reads the denylist array', () => {
    const result = extractGateDenylist(GATE_YAML);
    assert.deepEqual(result.patterns, ['**/.env', '**/secrets/**', '**/migrations/**']);
  });

  test('returns null on invalid YAML instead of throwing', () => {
    assert.equal(extractGateDenylist('denylist: [unclosed'), null);
  });

  test('returns null when denylist is absent', () => {
    assert.equal(extractGateDenylist('version: 1\n'), null);
  });

  test('collects non-string entries as malformed rather than dropping them silently', () => {
    const result = extractGateDenylist('denylist:\n  - "**/.env"\n  - 42\n');
    assert.deepEqual(result.patterns, ['**/.env']);
    assert.deepEqual(result.malformed, ['42']);
  });
});

describe('comparePolicies', () => {
  test('reports no drift when the two agree', () => {
    const drift = comparePolicies(extractSafetyDenylist(SAFETY_MD), extractGateDenylist(GATE_YAML));
    assert.equal(hasDrift(drift), false);
  });

  test('flags a path documented in safety.md but not enforced by gate.yaml', () => {
    const gate = extractGateDenylist(GATE_YAML.replace('  - "**/secrets/**"\n', ''));
    const drift = comparePolicies(extractSafetyDenylist(SAFETY_MD), gate);
    assert.deepEqual(drift.missingInGate, ['**/secrets/**']);
    assert.equal(drift.missingInDoc.length, 0);
    assert.equal(hasDrift(drift), true);
  });

  test('flags a path enforced by gate.yaml but undocumented in safety.md', () => {
    const gate = extractGateDenylist(GATE_YAML.replace('\nmaxFiles', '  - "**/ssh/**"\n\nmaxFiles'));
    const drift = comparePolicies(extractSafetyDenylist(SAFETY_MD), gate);
    assert.deepEqual(drift.missingInDoc, ['**/ssh/**']);
    assert.equal(drift.missingInGate.length, 0);
  });
});

describe('findUndocumentedLimits', () => {
  test('flags maxFiles when the prose never states it', () => {
    assert.deepEqual(findUndocumentedLimits(GATE_YAML, SAFETY_MD), ['maxFiles: 10']);
  });

  test('accepts prose phrasing like "more than 10 files"', () => {
    const doc = `${SAFETY_MD}\nEscalate on more than 10 files changed.\n`;
    assert.deepEqual(findUndocumentedLimits(GATE_YAML, doc), []);
  });

  test('accepts a literal maxFiles mention', () => {
    const doc = `${SAFETY_MD}\ngate.yaml sets maxFiles.\n`;
    assert.deepEqual(findUndocumentedLimits(GATE_YAML, doc), []);
  });
});

describe('runSync policy drift integration', () => {
  const dir = path.join(process.cwd(), '.test-policy-tmp');
  const opts = { autoFix: false, dryRun: false, verbose: false };
  const policyIssues = (r) =>
    r.issues.filter((i) => i.file.includes('gate.yaml') || i.file.includes('safety.md'));

  async function seed(gate, safety) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(path.join(dir, 'docs'), { recursive: true });
    for (const f of ['STATE.md', 'LOOP.md', 'AGENTS.md', 'loop-budget.md', 'loop-run-log.md']) {
      await writeFile(path.join(dir, f), '# stub\n');
    }
    if (gate !== null) await writeFile(path.join(dir, 'gate.yaml'), gate);
    if (safety !== null) await writeFile(path.join(dir, 'docs', 'safety.md'), safety);
  }

  test('is silent when gate.yaml and safety.md agree', async () => {
    await seed(GATE_YAML.replace('\nmaxFiles: 10\n', '\n'), SAFETY_MD);
    const report = await runSync({ targetDir: dir, ...opts });
    assert.deepEqual(policyIssues(report), []);
    await rm(dir, { recursive: true, force: true });
  });

  test('raises an error-severity issue for documented-but-unenforced paths', async () => {
    await seed(GATE_YAML.replace('  - "**/secrets/**"\n', ''), SAFETY_MD);
    const report = await runSync({ targetDir: dir, ...opts });
    const issue = report.issues.find(
      (i) => i.severity === 'error' && i.message.includes('not enforced'),
    );
    assert.ok(issue, 'expected an error issue for the unenforced path');
    assert.match(issue.message, /secrets/);
    await rm(dir, { recursive: true, force: true });
  });

  // The unenforced path is the one issue this module calls an error, and it was the
  // band that let it through: one error costs 20 points, the report stayed healthy
  // down to 70, and cli.ts exits 0 on healthy. Here the seeded project lands on
  // exactly 70 -- the edge of the old healthy band -- and must read as a warning.
  test('grades the report by its worst issue, not by a band 20 points wide', async () => {
    // The prose states the maxFiles limit too, so the drift error (-20) and the
    // LOOP.md warning (-10) are the only findings: score 70 exactly, the bottom of
    // the band the help text calls warning and the top of the old healthy band.
    const documented = `${SAFETY_MD}\nEscalate on more than 10 files changed.\n`;
    await seed(GATE_YAML.replace('  - "**/secrets/**"\n', ''), documented);
    const report = await runSync({ targetDir: dir, ...opts });
    assert.equal(report.score, 70);
    assert.equal(report.level, 'warning');
    await rm(dir, { recursive: true, force: true });
  });

  test('does not auto-fix a safety policy even with --auto-fix', async () => {
    const weakened = GATE_YAML.replace('  - "**/secrets/**"\n', '');
    await seed(weakened, SAFETY_MD);
    await runSync({ targetDir: dir, autoFix: true, dryRun: false, verbose: false });
    assert.equal(await readFile(path.join(dir, 'gate.yaml'), 'utf8'), weakened);
    await rm(dir, { recursive: true, force: true });
  });

  test('stays quiet when the project has no docs/safety.md', async () => {
    await seed(GATE_YAML, null);
    const report = await runSync({ targetDir: dir, ...opts });
    assert.deepEqual(
      policyIssues(report).filter((i) => i.type === 'inconsistent'),
      [],
    );
    await rm(dir, { recursive: true, force: true });
  });
});

describe('this repository', () => {
  test('gate.yaml denylist matches docs/safety.md (dogfood)', async () => {
    const gate = extractGateDenylist(await readFile(path.join(REPO_ROOT, 'gate.yaml'), 'utf8'));
    const safety = extractSafetyDenylist(
      await readFile(path.join(REPO_ROOT, 'docs/safety.md'), 'utf8'),
    );
    assert.ok(gate, 'repo gate.yaml should parse');
    assert.ok(safety, 'repo docs/safety.md should have a Path Denylist block');
    const drift = comparePolicies(safety, gate);
    assert.deepEqual(drift.missingInGate, [], 'safety.md documents paths gate.yaml does not enforce');
    assert.deepEqual(drift.missingInDoc, [], 'gate.yaml enforces paths safety.md does not document');
  });
});
