import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const CLI = path.resolve('dist/cli.js');

test('bundle-assets tolerates concurrent rebuilds', async () => {
  await Promise.all([
    exec('node', ['scripts/bundle-assets.mjs']),
    exec('node', ['scripts/bundle-assets.mjs']),
  ]);
  await access(path.join('starters', 'issue-triage', 'README.md'));
  await access(path.join('templates', 'SKILL.md.issue-triage'));
  await access('registry.yaml');
});

test('loop-init --help exits 0', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /changelog-drafter/);
  assert.match(stdout, /opencode/);
});

test('loop-init dry-run scaffolds daily-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
      '--dry-run',
    ]);
    assert.match(stdout, /loop-init: daily-triage/);
    assert.match(stdout, /would copy|copied/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init prints Loop Ready score after scaffold', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-audit-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
    ]);
    assert.match(stdout, /Loop Ready:/);
    assert.match(stdout, /\/100/);
    assert.match(stdout, /--badge/);
    assert.match(stdout, /Contribute \(~15 min tasks\):/);
    assert.match(stdout, /discussions\/123/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds issue-triage with bundled assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'issue-triage', '--tool', 'grok']);
    await access(path.join(dir, 'issue-triage-state.md'));
    await access(path.join(dir, '.grok', 'skills', 'issue-triage', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'));
    await access(path.join(dir, 'loop-budget.md'));
    await access(path.join(dir, 'loop-run-log.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds loop-intake for issue-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-intake-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'issue-triage', '--tool', 'grok']);
    await access(path.join(dir, '.grok', 'skills', 'loop-intake', 'SKILL.md'));
    assert.match(stdout, /Intake wired/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init does NOT scaffold loop-intake for report-only daily-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-no-intake-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    await assert.rejects(() => access(path.join(dir, '.grok', 'skills', 'loop-intake', 'SKILL.md')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init rejects unknown pattern', async () => {
  await assert.rejects(
    () => exec('node', [CLI, '.', '--pattern', 'not-a-pattern', '--tool', 'grok', '--dry-run']),
    (err) => err.stderr?.includes('Unknown pattern') || err.message?.includes('Unknown pattern'),
  );
});

test('loop-init rejects unknown tool', async () => {
  await assert.rejects(
    () => exec('node', [CLI, '.', '--pattern', 'daily-triage', '--tool', 'emacs', '--dry-run']),
    (err) => err.stderr?.includes('Unknown tool') || err.message?.includes('Unknown tool'),
  );
});

test('loop-init scaffolds daily-triage for opencode', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-opencode-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'opencode']);
    await access(path.join(dir, 'STATE.md'));
    await access(path.join(dir, 'LOOP.md'));
    await access(path.join(dir, 'AGENTS.md'));
    await access(path.join(dir, 'opencode.json'));
    await access(path.join(dir, 'skills', 'loop-triage', 'SKILL.md'));
    await access(path.join(dir, 'loop-budget.md'));
    await access(path.join(dir, 'loop-run-log.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds ci-sweeper with bundled assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'ci-sweeper', '--tool', 'grok']);
    await access(path.join(dir, 'ci-sweeper-state.md'));
    await access(path.join(dir, '.grok', 'skills', 'ci-triage', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'minimal-fix', 'SKILL.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'));
    await access(path.join(dir, 'loop-budget.md'));
    await access(path.join(dir, 'loop-run-log.md'));
    await access(path.join(dir, '.grok', 'skills', 'loop-budget', 'SKILL.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds circuit breaker (loop-guard + ledger) for fix patterns', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-cb-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'ci-sweeper', '--tool', 'grok']);
    await access(path.join(dir, '.grok', 'skills', 'loop-guard', 'SKILL.md'));
    const ledger = JSON.parse(await readFile(path.join(dir, 'loop-ledger.json'), 'utf8'));
    assert.equal(typeof ledger.goal, 'string');
    assert.ok(ledger.goal.length > 0);
    assert.equal(ledger.pattern, 'ci-sweeper');
    assert.match(ledger.level, /^L[123]$/);
    assert.deepEqual(ledger.attempts, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds circuit breaker for pr-babysitter (opencode paths)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-cb-oc-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'pr-babysitter', '--tool', 'opencode']);
    await access(path.join(dir, 'skills', 'loop-guard', 'SKILL.md'));
    await access(path.join(dir, 'loop-ledger.json'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init scaffolds explicit unknown readiness states for pr-babysitter', async () => {
  const skillPaths = {
    grok: ['.grok', 'skills', 'pr-review-triage', 'SKILL.md'],
    claude: ['.claude', 'skills', 'pr-review-triage', 'SKILL.md'],
    codex: ['.codex', 'skills', 'pr-review-triage', 'SKILL.md'],
    opencode: ['skills', 'pr-review-triage', 'SKILL.md'],
  };

  for (const [tool, skillParts] of Object.entries(skillPaths)) {
    const dir = await mkdtemp(path.join(tmpdir(), `loop-init-pr-readiness-${tool}-`));
    try {
      await exec('node', [CLI, dir, '--pattern', 'pr-babysitter', '--tool', tool]);
      const skill = await readFile(path.join(dir, ...skillParts), 'utf8');
      assert.match(skill, /passing \| failing \| pending \| absent\/unknown/);
      assert.match(skill, /zero checks|no check runs/i);
      assert.match(skill, /mergeable[\s\S]*does\s+not mean[\s\S]*ready/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test('loop-init does NOT scaffold circuit breaker for report-only daily-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-nocb-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    await assert.rejects(() => access(path.join(dir, 'loop-ledger.json')));
    await assert.rejects(() => access(path.join(dir, '.grok', 'skills', 'loop-guard', 'SKILL.md')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init prints foundry CTA without --with-foundry', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-cta-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    assert.match(stdout, /--with-foundry/);
    assert.match(stdout, /harness-foundry/);
    await assert.rejects(() => access(path.join(dir, '.foundry', 'stack.yaml')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-foundry scaffolds minimal stack for daily-triage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-foundry-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
      '--with-foundry',
    ]);
    await access(path.join(dir, '.foundry', 'stack.yaml'));
    await access(path.join(dir, '.foundry', 'hooks', 'outerloop.yaml'));
    await access(path.join(dir, '.foundry', 'README.md'));
    const stack = await readFile(path.join(dir, '.foundry', 'stack.yaml'), 'utf8');
    assert.match(stack, /model\/mock/);
    assert.match(stack, /emit\/outerloop-evidence/);
    assert.match(stdout, /Harness stack ready/);
    assert.match(stdout, /preset: minimal/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-foundry scaffolds implementer stack for ci-sweeper', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-foundry-impl-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'ci-sweeper',
      '--tool',
      'grok',
      '--with-foundry',
    ]);
    const stack = await readFile(path.join(dir, '.foundry', 'stack.yaml'), 'utf8');
    assert.match(stack, /model\/anthropic/);
    assert.match(stack, /tools\/git-worktree-write/);
    assert.match(stack, /recovery\/revert-on-test-fail/);
    assert.match(stdout, /preset: implementer/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --help documents --with-foundry', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /--with-foundry/);
  assert.match(stdout, /harness-foundry|implementer|minimal/);
});

test('loop-init prints memory CTA without --with-memory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-mem-cta-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    assert.match(stdout, /--with-memory/);
    assert.match(stdout, /memory-engineering/);
    await assert.rejects(() => access(path.join(dir, 'memory-tiers.md')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-memory scaffolds tiers and budget', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-memory-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
      '--with-memory',
    ]);
    await access(path.join(dir, 'memory-tiers.md'));
    await access(path.join(dir, 'memory-budget.md'));
    const tiers = await readFile(path.join(dir, 'memory-tiers.md'), 'utf8');
    assert.match(tiers, /Working Memory/);
    assert.match(stdout, /Memory engineering stack ready/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --help documents --with-memory', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /--with-memory/);
  assert.match(stdout, /memory-engineering tiers and budget/);
});

test('loop-init prints fleet CTA without --with-fleet', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-fleet-cta-'));
  try {
    const { stdout } = await exec('node', [CLI, dir, '--pattern', 'daily-triage', '--tool', 'grok']);
    assert.match(stdout, /--with-fleet/);
    assert.match(stdout, /fleet-engineering/);
    await assert.rejects(() => access(path.join(dir, 'fleet-registry.md')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-fleet scaffolds registry and inbox', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-fleet-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'daily-triage',
      '--tool',
      'grok',
      '--with-fleet',
    ]);
    await access(path.join(dir, 'fleet-registry.md'));
    await access(path.join(dir, 'fleet-inbox.md'));
    const registry = await readFile(path.join(dir, 'fleet-registry.md'), 'utf8');
    assert.match(registry, /Fleet Registry/);
    assert.match(stdout, /Fleet engineering stack ready/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --help documents --with-fleet', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /--with-fleet/);
  assert.match(stdout, /fleet-engineering registry and inbox/);
});
