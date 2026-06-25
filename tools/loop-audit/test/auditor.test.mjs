import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { auditProject, computeScore } from '../dist/auditor.js';
import { formatBadge } from '../dist/reporter.js';

function emptySignals() {
  return {
    stateFile: { present: false, paths: [] },
    loopConfig: { present: false },
    skills: { count: 0, loopSkills: [] },
    verifier: { present: false },
    triage: { present: false },
    agentsMd: { present: false },
    patterns: { documented: false },
    safety: { loopMdMentionsSafety: false, safetyDocPresent: false },
    starters: { used: false },
    github: { present: false, workflows: false },
    mcp: { present: false },
    worktreeEvidence: { present: false },
    registry: { present: false },
    constraints: { present: false, hasConstraintsSkill: false },
    cost: { budgetDoc: false, runLog: false, loopMdBudget: false, budgetSkill: false },
    loopActivity: { present: false, evidence: [] },
  };
}

test('computeScore: empty project is L0', () => {
  const { score, level } = computeScore(emptySignals());
  assert.equal(level, 'L0');
  assert.ok(score < 38);
});

test('computeScore: state + triage reaches L1', () => {
  const s = emptySignals();
  s.stateFile = { present: true, paths: ['STATE.md'] };
  s.triage = { present: true };
  const { level, score } = computeScore(s);
  assert.equal(level, 'L1');
  assert.ok(score >= 38);
});

test('computeScore: full L2 signals', () => {
  const s = emptySignals();
  s.stateFile = { present: true, paths: ['STATE.md'] };
  s.triage = { present: true };
  s.skills = { count: 2, loopSkills: ['loop-triage', 'loop-verifier'] };
  s.verifier = { present: true };
  const { level, score } = computeScore(s);
  assert.equal(level, 'L2');
  assert.ok(score >= 58 && score < 78);
});

test('computeScore: L3 requires verifier, high score, cost observability, and activity', () => {
  const s = emptySignals();
  s.stateFile = { present: true, paths: ['STATE.md'] };
  s.triage = { present: true };
  s.loopConfig = { present: true, path: 'LOOP.md' };
  s.agentsMd = { present: true };
  s.skills = { count: 3, loopSkills: ['loop-triage', 'minimal-fix', 'loop-verifier'] };
  s.verifier = { present: true };
  s.safety = { loopMdMentionsSafety: true, safetyDocPresent: true };
  s.github = { present: true, workflows: true };
  s.mcp = { present: true };
  s.worktreeEvidence = { present: true };
  s.registry = { present: true };
  s.cost = { budgetDoc: true, runLog: true, loopMdBudget: true, budgetSkill: true };
  s.loopActivity = { present: true, evidence: ['git:state update', 'state:STATE.md'] };
  const { level, score } = computeScore(s);
  assert.equal(level, 'L3');
  assert.ok(score >= 78);
});

test('computeScore: L3 blocked without cost observability', () => {
  const s = emptySignals();
  s.stateFile = { present: true, paths: ['STATE.md'] };
  s.triage = { present: true };
  s.loopConfig = { present: true, path: 'LOOP.md' };
  s.agentsMd = { present: true };
  s.skills = { count: 3, loopSkills: ['loop-triage', 'minimal-fix', 'loop-verifier'] };
  s.verifier = { present: true };
  s.safety = { loopMdMentionsSafety: true, safetyDocPresent: true };
  s.github = { present: true, workflows: true };
  s.mcp = { present: true };
  s.worktreeEvidence = { present: true };
  s.registry = { present: true };
  s.loopActivity = { present: true, evidence: ['state:STATE.md'] };
  const { level } = computeScore(s);
  assert.equal(level, 'L2');
});

test('computeScore: high structure without activity caps at L2', () => {
  const s = emptySignals();
  s.stateFile = { present: true, paths: ['STATE.md'] };
  s.triage = { present: true };
  s.loopConfig = { present: true, path: 'LOOP.md' };
  s.agentsMd = { present: true };
  s.skills = { count: 3, loopSkills: ['loop-triage', 'minimal-fix', 'loop-verifier'] };
  s.verifier = { present: true };
  s.safety = { loopMdMentionsSafety: true, safetyDocPresent: true };
  s.github = { present: true, workflows: true };
  s.registry = { present: true };
  s.cost = { budgetDoc: true, runLog: true, loopMdBudget: true, budgetSkill: true };
  const { level } = computeScore(s);
  assert.equal(level, 'L2');
});

test('auditProject: empty directory scores low', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-empty-'));
  try {
    const result = await auditProject(dir);
    assert.equal(result.level, 'L0');
    assert.ok(result.score < 40);
    assert.ok(result.findings.some((f) => f.level === 'fail'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: minimal L1 layout', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-l1-'));
  try {
    await writeFile(path.join(dir, 'STATE.md'), '# State\n');
    await mkdir(path.join(dir, '.grok', 'skills', 'loop-triage'), { recursive: true });
    await writeFile(
      path.join(dir, '.grok', 'skills', 'loop-triage', 'SKILL.md'),
      '---\nname: loop-triage\ndescription: triage\n---\n# Triage\n',
    );
    const result = await auditProject(dir);
    assert.equal(result.level, 'L1');
    assert.ok(result.signals.triage.present);
    assert.ok(result.signals.stateFile.present);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('formatBadge: includes level and score', () => {
  const badge = formatBadge({
    target: '/tmp',
    score: 72,
    level: 'L2',
    assessment: 'test',
    signals: emptySignals(),
    findings: [],
    recommendations: [],
  });
  assert.match(badge, /Loop Ready L2 \(72\/100\)/);
  assert.match(badge, /img\.shields\.io/);
  assert.match(badge, /loop-engineering/);
});

test('auditProject: git commit with triage counts as loop activity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-git-'));
  try {
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
    await writeFile(path.join(dir, 'README.md'), '# test\n');
    execSync('git add README.md', { cwd: dir, stdio: 'ignore' });
    execSync('git commit -m "chore: daily triage update"', { cwd: dir, stdio: 'ignore' });
    const result = await auditProject(dir);
    assert.ok(result.signals.loopActivity.present);
    assert.ok(result.signals.loopActivity.evidence.some((e) => e.startsWith('git:')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: L2 with verifier skill', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-l2-'));
  try {
    await writeFile(path.join(dir, 'STATE.md'), '# State\n');
    for (const skill of ['loop-triage', 'loop-verifier']) {
      await mkdir(path.join(dir, '.grok', 'skills', skill), { recursive: true });
      await writeFile(
        path.join(dir, '.grok', 'skills', skill, 'SKILL.md'),
        `---\nname: ${skill}\ndescription: test\n---\n# ${skill}\n`,
      );
    }
    const result = await auditProject(dir);
    assert.equal(result.level, 'L2');
    assert.ok(result.signals.verifier.present);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});