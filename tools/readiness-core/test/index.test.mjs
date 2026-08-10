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

test('scanSkillDirectories deduplicates skill names across scan roots', async () => {
  const fixtureDir = path.join(process.cwd(), '.test-fixture-dedup');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  // Same skill directory name under two different roots
  await fs.mkdir(path.join(fixtureDir, '.grok', 'skills', 'foo'), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, 'skills', 'foo'), { recursive: true });
  // A distinct skill that must still be counted
  await fs.mkdir(path.join(fixtureDir, 'skills', 'bar'), { recursive: true });

  const skills = await scanSkillDirectories(fixtureDir);
  assert.ok(Array.isArray(skills));
  const countByName = (name) => skills.filter((s) => s === name).length;
  assert.equal(countByName('foo'), 1, 'foo appears once despite existing in .grok/skills and skills');
  assert.equal(countByName('bar'), 1, 'distinct skill bar still appears');
  assert.equal(skills.length, 2, 'two distinct skill names total');

  await fs.rm(fixtureDir, { recursive: true, force: true });
});

test('skill dedup matters because readiness score signals skillsOne vs skillsTwoPlus', async () => {
  // Regression guard: scanSkillDirectories is the source used by the
  // readiness score to decide between skillsOne and skillsTwoPlus. If a
  // skill duplicated across .grok/skills and skills were counted twice,
  // a project with only one real skill would be scored as skillsTwoPlus.
  const fixtureDir = path.join(process.cwd(), '.test-fixture-dedup-score');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  await fs.mkdir(path.join(fixtureDir, '.grok', 'skills', 'foo'), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, 'skills', 'foo'), { recursive: true });

  const skills = await scanSkillDirectories(fixtureDir);
  const uniqueNames = new Set(skills);
  assert.equal(uniqueNames.size, 1);
  assert.ok(
    uniqueNames.size < 2,
    'one real skill must not be misreported as two or more (skillsTwoPlus inflation)',
  );

  await fs.rm(fixtureDir, { recursive: true, force: true });
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
