import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
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
    governance: { toolScope: false, stallDetection: false, escalation: false, gateYaml: false },
    loopActivity: { present: false, evidence: [] },
    harness: { stack: false, lock: false, sessions: false, emit: false, host: false },
    memory: { tiers: false, budget: false },
    fleet: { registry: false, inbox: false },
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

test('computeScore: governance signals add points', () => {
  const base = emptySignals();
  const { score: without } = computeScore(base);
  const withGov = emptySignals();
  withGov.governance = { toolScope: true, stallDetection: true, escalation: true };
  const { score: withScore } = computeScore(withGov);
  assert.equal(withScore - without, 9);
});

test('auditProject: governance signals detected from docs and skill frontmatter', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-gov-'));
  try {
    await writeFile(
      path.join(dir, 'LOOP.md'),
      '# Loop\nTool scope: least-privilege per role.\nUses loop-context circuit breaker with max attempts; on no-progress, escalate to a human (exit code 2).\n',
    );
    await mkdir(path.join(dir, '.claude', 'skills', 'loop-triage'), { recursive: true });
    await writeFile(
      path.join(dir, '.claude', 'skills', 'loop-triage', 'SKILL.md'),
      '---\nname: loop-triage\ndescription: triage\nallowed-tools: Read, Grep\n---\n# Triage\n',
    );
    const result = await auditProject(dir);
    assert.ok(result.signals.governance.toolScope);
    assert.ok(result.signals.governance.stallDetection);
    assert.ok(result.signals.governance.escalation);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: governance signals absent in bare project', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-nogov-'));
  try {
    const result = await auditProject(dir);
    assert.equal(result.signals.governance.toolScope, false);
    assert.equal(result.signals.governance.stallDetection, false);
    assert.equal(result.signals.governance.escalation, false);
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

test('computeScore: gateYaml adds points', () => {
  const base = emptySignals();
  const { score: without } = computeScore(base);
  const withGate = emptySignals();
  withGate.governance.gateYaml = true;
  const { score: withScore } = computeScore(withGate);
  assert.equal(withScore - without, 3);
});

test('computeScore: harness signals add points', () => {
  const base = emptySignals();
  const { score: without } = computeScore(base);
  const withHarness = emptySignals();
  withHarness.harness = { stack: true, lock: true, sessions: true, emit: true, host: true };
  const { score: withScore } = computeScore(withHarness);
  assert.equal(withScore - without, 9);
});

test('auditProject: detects .foundry stack and emit hook', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-foundry-'));
  try {
    await mkdir(path.join(dir, '.foundry', 'hooks'), { recursive: true });
    await writeFile(
      path.join(dir, '.foundry', 'stack.yaml'),
      'name: demo\nversion: 1.0.0\nlayers:\n  reliability:\n    - primitive: emit/outerloop-evidence\n',
    );
    await writeFile(
      path.join(dir, '.foundry', 'hooks', 'outerloop.yaml'),
      'enabled: false\nadapter: outerloop\n',
    );
    const result = await auditProject(dir);
    assert.equal(result.signals.harness.stack, true);
    assert.equal(result.signals.harness.emit, true);
    assert.equal(result.signals.harness.sessions, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: missing harness recommends --with-foundry', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-nofoundry-'));
  try {
    const result = await auditProject(dir);
    assert.equal(result.signals.harness.stack, false);
    assert.ok(result.recommendations.some((r) => r.includes('--with-foundry') || r.includes('harness-foundry')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('computeScore: memory signals add points', () => {
  const base = emptySignals();
  const { score: without } = computeScore(base);
  const withMemory = emptySignals();
  withMemory.memory = { tiers: true, budget: true };
  const { score: withScore } = computeScore(withMemory);
  assert.equal(withScore - without, 6);
});

test('auditProject: missing memory recommends --with-memory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-nomemory-'));
  try {
    const result = await auditProject(dir);
    assert.equal(result.signals.memory.tiers, false);
    assert.ok(result.recommendations.some((r) => r.includes('--with-memory')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('computeScore: fleet signals add points', () => {
  const base = emptySignals();
  const { score: without } = computeScore(base);
  const withFleet = emptySignals();
  withFleet.fleet = { registry: true, inbox: true };
  const { score: withScore } = computeScore(withFleet);
  assert.equal(withScore - without, 6);
});

test('auditProject: missing fleet recommends --with-fleet', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-nofleet-'));
  try {
    const result = await auditProject(dir);
    assert.equal(result.signals.fleet.registry, false);
    assert.ok(result.recommendations.some((r) => r.includes('--with-fleet')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: git commit of STATE.md counts as loop activity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-git-'));
  try {
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
    const today = new Date().toISOString();
    await writeFile(path.join(dir, 'STATE.md'), `# State\n\nLast run: ${today}\n`);
    execSync('git add STATE.md', { cwd: dir, stdio: 'ignore' });
    execSync('git commit -m "chore: daily triage update"', { cwd: dir, stdio: 'ignore' });
    const result = await auditProject(dir);
    assert.ok(result.signals.loopActivity.present);
    assert.ok(
      result.signals.loopActivity.evidence.some((e) => e.startsWith('git:') || e.startsWith('state:')),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: triage commit that does not touch state is not activity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-git-readme-'));
  try {
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
    await writeFile(path.join(dir, 'README.md'), '# test\n');
    execSync('git add README.md', { cwd: dir, stdio: 'ignore' });
    execSync('git commit -m "chore: daily triage update"', { cwd: dir, stdio: 'ignore' });
    const result = await auditProject(dir);
    assert.equal(result.signals.loopActivity.present, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: stale Last run is not activity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-stale-'));
  try {
    await writeFile(path.join(dir, 'STATE.md'), '# State\n\nLast run: 2020-01-01T00:00:00Z\n');
    const result = await auditProject(dir);
    assert.equal(result.signals.loopActivity.present, false);
    assert.ok(result.findings.some((f) => /older than 14 days/i.test(f.message)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: LOOP.md cadence text is not activity', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-loopmd-'));
  try {
    await writeFile(path.join(dir, 'LOOP.md'), '# Loop\nCadence: scheduled daily automation.\nLast run documented here as a heading only.\n');
    const result = await auditProject(dir);
    assert.equal(result.signals.loopActivity.present, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('auditProject: thin-loop workflow without STATE.md is a warning not a fail', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-thin-'));
  try {
    await mkdir(path.join(dir, '.github', 'workflows'), { recursive: true });
    await writeFile(path.join(dir, '.github', 'workflows', 'thin-loop.yml'), 'name: Thin loop\n');
    const result = await auditProject(dir);
    assert.equal(result.signals.stateFile.present, false);
    assert.ok(result.findings.some((f) => f.level === 'warn' && /thin loop/i.test(f.message)));
    assert.ok(!result.findings.some((f) => f.level === 'fail' && /No state file/i.test(f.message)));
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

test('auditProject: opencode.json verifier agent counts as loop-verifier', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-audit-opencode-'));
  try {
    await writeFile(path.join(dir, 'STATE.md'), '# State\n');
    await mkdir(path.join(dir, 'skills', 'loop-triage'), { recursive: true });
    await writeFile(
      path.join(dir, 'skills', 'loop-triage', 'SKILL.md'),
      '---\nname: loop-triage\ndescription: triage\n---\n# Triage\n',
    );
    await writeFile(
      path.join(dir, 'opencode.json.example'),
      JSON.stringify({
        agent: {
          verifier: { name: 'verifier', description: 'Checker agent' },
        },
      }),
    );
    const result = await auditProject(dir);
    assert.ok(result.signals.verifier.present);
    assert.equal(result.level, 'L2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-audit CLI prints contributor CTA on human output', () => {
  const stdout = execFileSync('node', ['dist/cli.js', '../../'], { encoding: 'utf8' });
  assert.match(stdout, /Contribute \(~15 min tasks\):/);
  assert.match(stdout, /discussions\/123/);
});

test('loop-audit CLI omits contributor CTA for --json', () => {
  const stdout = execFileSync('node', ['dist/cli.js', '../../', '--json'], { encoding: 'utf8' });
  assert.doesNotMatch(stdout, /discussions\/123/);
});