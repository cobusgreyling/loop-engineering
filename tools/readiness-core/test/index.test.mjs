import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileExists, scanSkillDirectories } from '../dist/index.js';

test('fileExists returns true for existing file', async () => {
  const result = await fileExists(path.join(process.cwd(), 'package.json'));
  assert.strictEqual(result, true);
});

test('fileExists returns false for missing file', async () => {
  const result = await fileExists(path.join(process.cwd(), 'missing.json'));
  assert.strictEqual(result, false);
});

test('scanSkillDirectories finds skills in target directory', async () => {
  // We can test this by running it on a known directory or setting up a mock
  // For simplicity, let's scan the current directory and ensure it handles empty or missing gracefully.
  const missingSkills = await scanSkillDirectories(path.join(process.cwd(), 'test-data-missing'));
  assert.deepStrictEqual(missingSkills, []);

  // Setup a mock fixture
  const fixtureDir = path.join(process.cwd(), '.test-fixture');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  await fs.mkdir(path.join(fixtureDir, '.grok', 'skills', 'foo'), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, 'skills', 'bar'), { recursive: true });
  await fs.writeFile(path.join(fixtureDir, 'skills', 'SKILL.md'), '# root-skill\n');

  const skills = await scanSkillDirectories(fixtureDir);
  assert.ok(skills.includes('foo'), 'Should detect tool-specific skill foo');
  assert.ok(skills.includes('bar'), 'Should detect generic skill bar');
  assert.ok(skills.includes('root-skill'), 'Should detect root SKILL.md');

  await fs.rm(fixtureDir, { recursive: true, force: true });
});

test('scanSkillDirectories deduplicates skill names across scanned roots', async () => {
  // Regression test for double-counting: the same skill installed in two
  // scanned roots (e.g. .grok/skills/foo and skills/foo) must count once.
  // Duplicates inflate the Loop Readiness score by flipping the skillsOne
  // signal to skillsTwoPlus for what is really a single skill.
  const fixtureDir = path.join(process.cwd(), '.test-fixture-dedup');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  await fs.mkdir(path.join(fixtureDir, '.grok', 'skills', 'foo'), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, 'skills', 'foo'), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, 'skills', 'bar'), { recursive: true });

  const skills = await scanSkillDirectories(fixtureDir);
  assert.strictEqual(
    skills.filter((name) => name === 'foo').length,
    1,
    'Same skill name under two roots should count once',
  );
  assert.ok(skills.includes('bar'), 'Distinct skill names should still count separately');
  assert.strictEqual(skills.length, 2, 'Should report exactly foo and bar');

  await fs.rm(fixtureDir, { recursive: true, force: true });
});
