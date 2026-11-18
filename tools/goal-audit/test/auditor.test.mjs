import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditProject } from '../dist/auditor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(__dirname, 'fixtures');

test('good-goal-project fixture scores G2+', async () => {
  const target = path.join(fixturesRoot, 'good-goal-project');
  const result = await auditProject(target);
  assert.ok(result.score >= 60, `expected G2+, got ${result.score} (${result.level})`);
  assert.equal(result.signals.verifier.present, true);
  assert.equal(result.signals.goalFile.present, true);
});

test('empty temp dir scores low', async () => {
  const tmp = path.join(fixturesRoot, 'fixtures-empty');
  const result = await auditProject(tmp);
  assert.ok(result.score < 40);
  assert.equal(result.level, 'G0');
});

const GOAL_LOCATIONS = [['GOAL.md'], ['goal.md'], ['docs', 'GOAL.md']];

test('a goal file scores the same wherever GOAL_FILES allows it', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'goal-audit-'));
  const scores = [];
  for (const [index, parts] of GOAL_LOCATIONS.entries()) {
    const dir = path.join(base, `case-${index}`);
    const file = path.join(dir, ...parts);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '# Goal\nship the thing\n');
    const where = parts.join('/');
    const result = await auditProject(dir);
    assert.equal(result.signals.goalFile.present, true, `${where} should count as a goal file`);
    assert.equal(
      result.signals.goalConfig.present,
      true,
      `${where} must not read as missing goal config`
    );
    scores.push(result.score);
  }
  assert.equal(new Set(scores).size, 1, `location changed the score: ${scores.join(', ')}`);
});
