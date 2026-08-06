import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, access, chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  normalizeStatus as normalizeRepairStatus,
  parseArgs as parseCollectorArgs,
} from '../starters/issue-pr-repair/scripts/collect-repair-evidence.mjs';
import { labelDefinitions } from '../starters/issue-pr-repair/scripts/install-github-labels.mjs';
import {
  claimLabels as genericClaimLabels,
  parseArgs as parseLeaseArgs,
} from '../starters/issue-pr-repair/scripts/repair-lease.mjs';

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

test('loop-init --with-foundry --model-provider minimax emits MiniMax provider primitive', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-foundry-minimax-'));
  try {
    const { stdout } = await exec('node', [
      CLI,
      dir,
      '--pattern',
      'ci-sweeper',
      '--tool',
      'grok',
      '--with-foundry',
      '--model-provider',
      'minimax',
    ]);
    const stack = await readFile(path.join(dir, '.foundry', 'stack.yaml'), 'utf8');
    assert.match(stack, /primitive: model\/minimax/);
    assert.match(stack, /model: MiniMax-M3/);
    assert.match(stack, /- id: MiniMax-M3/);
    assert.match(stack, /- id: MiniMax-M2\.7/);
    assert.match(stack, /region: global_en/);
    // global endpoint
    assert.match(stack, /https:\/\/api\.minimax\.io\/v1/);
    // CN endpoint
    assert.match(stack, /https:\/\/api\.minimaxi\.com\/v1/);
    assert.doesNotMatch(stack, /model\/anthropic/);
    assert.match(stdout, /preset: implementer/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-foundry minimax --region cn_zh selects CN region and model', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-foundry-minimax-cn-'));
  try {
    await exec('node', [
      CLI,
      dir,
      '--pattern',
      'ci-sweeper',
      '--tool',
      'grok',
      '--with-foundry',
      '--model-provider',
      'minimax',
      '--region',
      'cn_zh',
      '--model',
      'MiniMax-M2.7',
    ]);
    const stack = await readFile(path.join(dir, '.foundry', 'stack.yaml'), 'utf8');
    assert.match(stack, /region: cn_zh/);
    assert.match(stack, /model: MiniMax-M2\.7/);
    // both regional endpoints remain available in config
    assert.match(stack, /global_en:/);
    assert.match(stack, /cn_zh:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init --with-foundry anthropic provider is unchanged (default)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-foundry-default-'));
  try {
    await exec('node', [
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
    assert.doesNotMatch(stack, /model\/minimax/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loop-init rejects unknown model provider', async () => {
  await assert.rejects(
    () =>
      exec('node', [
        CLI,
        '.',
        '--pattern',
        'ci-sweeper',
        '--tool',
        'grok',
        '--with-foundry',
        '--model-provider',
        'not-a-provider',
        '--dry-run',
      ]),
    (err) =>
      err.stderr?.includes('Unknown model provider') ||
      err.message?.includes('Unknown model provider'),
  );
});

test('loop-init rejects unknown minimax model', async () => {
  await assert.rejects(
    () =>
      exec('node', [
        CLI,
        '.',
        '--pattern',
        'ci-sweeper',
        '--tool',
        'grok',
        '--with-foundry',
        '--model-provider',
        'minimax',
        '--model',
        'not-a-model',
        '--dry-run',
      ]),
    (err) => err.stderr?.includes('Unknown model') || err.message?.includes('Unknown model'),
  );
});

test('loop-init --help documents --model-provider minimax', async () => {
  const { stdout } = await exec('node', [CLI, '--help']);
  assert.match(stdout, /--model-provider/);
  assert.match(stdout, /minimax/);
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

const SCAFFOLD_PATTERNS = {
  'daily-triage': {
    state: 'STATE.md',
    primarySkill: 'loop-triage',
    fixCapable: false,
    intake: false,
  },
  'pr-babysitter': {
    state: 'pr-babysitter-state.md',
    primarySkill: 'pr-review-triage',
    fixCapable: true,
    intake: false,
  },
  'ci-sweeper': {
    state: 'ci-sweeper-state.md',
    primarySkill: 'ci-triage',
    fixCapable: true,
    intake: false,
  },
  'dependency-sweeper': {
    state: 'dependency-sweeper-state.md',
    primarySkill: 'dependency-triage',
    fixCapable: true,
    intake: false,
  },
  'post-merge-cleanup': {
    state: 'post-merge-state.md',
    primarySkill: 'post-merge-scan',
    fixCapable: true,
    intake: false,
  },
  'changelog-drafter': {
    state: 'changelog-drafter-state.md',
    primarySkill: 'changelog-scan',
    fixCapable: false,
    intake: false,
  },
  'issue-triage': {
    state: 'issue-triage-state.md',
    primarySkill: 'issue-triage',
    fixCapable: false,
    intake: true,
  },
  'issue-pr-repair': {
    state: 'repair-loop-state.md',
    primarySkill: 'issue-pr-repair',
    fixCapable: true,
    intake: true,
  },
};

const SCAFFOLD_TOOLS = {
  grok: ['.grok', 'skills'],
  claude: ['.claude', 'skills'],
  codex: ['.codex', 'skills'],
  opencode: ['skills'],
};

async function expectPathExists(...parts) {
  await access(path.join(...parts));
}

async function expectPathMissing(...parts) {
  await assert.rejects(() => access(path.join(...parts)));
}

for (const [pattern, contract] of Object.entries(SCAFFOLD_PATTERNS)) {
  for (const [tool, skillRoot] of Object.entries(SCAFFOLD_TOOLS)) {
    test(`loop-init scaffold matrix: ${pattern} for ${tool}`, async () => {
      const dir = await mkdtemp(path.join(tmpdir(), `loop-init-matrix-${pattern}-${tool}-`));
      try {
        const { stdout } = await exec('node', [
          CLI,
          dir,
          '--pattern',
          pattern,
          '--tool',
          tool,
        ]);

        assert.match(stdout, new RegExp(`loop-init: ${pattern}`));
        await expectPathExists(dir, contract.state);
        await expectPathExists(dir, 'AGENTS.md');
        await expectPathExists(dir, 'loop-budget.md');
        await expectPathExists(dir, 'loop-run-log.md');
        await expectPathExists(dir, 'loop-constraints.md');
        await expectPathExists(dir, ...skillRoot, contract.primarySkill, 'SKILL.md');
        await expectPathExists(dir, ...skillRoot, 'loop-budget', 'SKILL.md');
        await expectPathExists(dir, ...skillRoot, 'loop-constraints', 'SKILL.md');

        if (tool === 'opencode') {
          await expectPathExists(dir, 'opencode.json');
        }

        if (contract.fixCapable) {
          await expectPathExists(dir, 'loop-ledger.json');
          await expectPathExists(dir, ...skillRoot, 'minimal-fix', 'SKILL.md');
          await expectPathExists(dir, ...skillRoot, 'loop-guard', 'SKILL.md');

          const ledger = JSON.parse(await readFile(path.join(dir, 'loop-ledger.json'), 'utf8'));
          assert.equal(ledger.pattern, pattern);
          assert.match(ledger.level, /^L[12]$/);
          assert.deepEqual(ledger.attempts, []);
        } else {
          await expectPathMissing(dir, 'loop-ledger.json');
          await expectPathMissing(dir, ...skillRoot, 'loop-guard', 'SKILL.md');
        }

        if (contract.intake) {
          await expectPathExists(dir, ...skillRoot, 'loop-intake', 'SKILL.md');
        } else {
          await expectPathMissing(dir, ...skillRoot, 'loop-intake', 'SKILL.md');
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
}

test('loop-init issue-pr-repair scaffolds executable policy contracts', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-repair-contracts-'));
  try {
    await exec('node', [CLI, dir, '--pattern', 'issue-pr-repair', '--tool', 'codex']);
    await expectPathExists(dir, 'repair.yaml');
    await expectPathExists(dir, 'promotion.yaml');
    await expectPathExists(dir, 'repair-evidence.example.json');
    for (const script of [
      'collect-repair-evidence.mjs',
      'install-github-labels.mjs',
      'repair-lease.mjs',
    ]) {
      const scriptPath = path.join(dir, 'scripts', script);
      await access(scriptPath);
      assert.notEqual((await stat(scriptPath)).mode & 0o111, 0, `${script} should remain executable`);
      const { stdout } = await exec('node', [scriptPath, '--help']);
      assert.match(stdout, /Dry-run|trusted GitHub/i);
    }
    const repair = await readFile(path.join(dir, 'repair.yaml'), 'utf8');
    const promotion = await readFile(path.join(dir, 'promotion.yaml'), 'utf8');
    assert.match(repair, /maxAttempts: 3/);
    assert.match(promotion, /requireDatasetMatch: true/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('issue-pr-repair GitHub adapters validate configuration and custom policy labels', () => {
  assert.throws(
    () => parseCollectorArgs(['--repository', 'owner/repo', '--output', 'evidence.json']),
    /--required-check/,
  );
  assert.equal(normalizeRepairStatus('completed', 'success'), 'success');
  assert.equal(normalizeRepairStatus('queued'), 'pending');
  assert.throws(
    () => parseLeaseArgs(['--repository', 'owner/repo', '--decision', 'decision.json', '--risk', 'low', '--max-attempts', '0']),
    /positive integer/,
  );
  const labels = genericClaimLabels(['defect', 'tries:1', 'impact:low'], 'medium', 1, {
    lockLabel: 'repair:locked',
    watchLabel: 'repair:managed',
    attemptPrefix: 'tries:',
    riskPrefix: 'impact:',
    maxAttempts: 4,
  });
  assert.deepEqual(
    labels,
    ['defect', 'repair:locked', 'repair:managed', 'tries:2', 'impact:medium'],
  );
  const names = labelDefinitions().map(([name]) => name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('loop-pause-all'));
  assert.ok(names.includes('loop:attempts:3'));
  assert.ok(names.includes('area:deployment'));
});

test('fresh issue-pr-repair scaffold runs trusted intake, planning, and lease dry-run', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-init-repair-live-'));
  const mockBin = path.join(dir, 'mock-bin');
  const mockGh = path.join(mockBin, 'gh');
  const evidence = path.join(dir, '.loop', 'evidence.json');
  const decision = path.join(dir, '.loop', 'decision.json');
  try {
    await exec('node', [CLI, dir, '--pattern', 'issue-pr-repair', '--tool', 'codex']);
    await mkdir(mockBin, { recursive: true });
    await writeFile(mockGh, `#!/bin/sh
case "$2" in
  *"/issues?state=open"*) printf '%s' '[[{"number":42,"title":"Reproduced defect","updated_at":"2026-08-06T00:00:00Z","labels":[{"name":"bug"},{"name":"loop:reproduced"}]}]]' ;;
  *"/pulls?state=open"*) printf '%s' '[[]]' ;;
  *"/timeline"*) printf '%s' '[[]]' ;;
  *"/issues/42") printf '%s' '{"labels":[{"name":"bug"},{"name":"loop:reproduced"}]}' ;;
  *) printf '%s\n' "unexpected gh endpoint: $2" >&2; exit 2 ;;
esac
`);
    await chmod(mockGh, 0o755);
    const env = { ...process.env, PATH: `${mockBin}:${process.env.PATH}` };
    await exec('node', [
      path.join(dir, 'scripts', 'collect-repair-evidence.mjs'),
      '--repository', 'owner/repo',
      '--required-check', 'required-ci',
      '--output', evidence,
    ], { env });
    const planner = path.resolve('../loop-gate/dist/cli.js');
    const { stdout: decisionJson } = await exec('node', [
      planner,
      'repair-plan',
      '--contract', path.join(dir, 'repair.yaml'),
      '--evidence', evidence,
      '--json',
    ]);
    await writeFile(decision, decisionJson);
    const planned = JSON.parse(decisionJson);
    assert.equal(planned.state, 'selected');
    assert.equal(planned.selected.number, 42);
    const { stdout: leaseJson } = await exec('node', [
      path.join(dir, 'scripts', 'repair-lease.mjs'),
      '--repository', 'owner/repo',
      '--decision', decision,
      '--risk', 'low',
    ], { env });
    const lease = JSON.parse(leaseJson);
    assert.equal(lease.executed, false);
    assert.ok(lease.labels.includes('loop:repairing'));
    assert.ok(lease.labels.includes('loop:attempts:1'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
