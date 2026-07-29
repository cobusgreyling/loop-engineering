import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

async function setupGit(root) {
  spawnSync('git', ['init', '-b', 'main'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: root });
}

const cliUrl = new URL('../dist/cli.js', import.meta.url);
const cliPath = fileURLToPath(cliUrl);

test('loop-swarm run handles simple deterministic command', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  try {
    await setupGit(root);

    const scriptPath = join(root, 'agent.cjs');
    await writeFile(scriptPath, "require('fs').writeFileSync('changes.txt', 'swarm data\\n');");
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '2', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, `CLI failed: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, /Consensus reached! 2\/2/);

    const patchStat = await stat(join(root, '.loop-sandbox', 'patches', 'consensus.patch'));
    assert.ok(patchStat.size > 0, 'consensus.patch should be created');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loop-swarm run fails on divergent patches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  try {
    await setupGit(root);

    const scriptPath = join(root, 'agent.cjs');
    // Non-deterministic agent
    await writeFile(scriptPath, "require('fs').writeFileSync('changes.txt', 'swarm data ' + Math.random() + '\\n');");
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '2', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.notStrictEqual(result.status, 0, 'CLI should fail on divergent patches');
    assert.match(result.stdout, /Swarm failed to reach consensus/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loop-swarm handles all-failed agents properly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  try {
    await setupGit(root);

    const scriptPath = join(root, 'agent.cjs');
    // Agent that fails
    await writeFile(scriptPath, "process.exit(1);");
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '3', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.notStrictEqual(result.status, 0, 'CLI should fail if all agents fail');
    assert.match(result.stdout, /3 agent\(s\) failed with non-zero exit codes/);
    assert.match(result.stdout, /Swarm failed to reach consensus/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loop-swarm handles 2-of-3 majority with 1 divergent patch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  try {
    await setupGit(root);

    const counterFile = join(tmpdir(), 'loop-swarm-counter-' + Math.random().toString().slice(2));
    await writeFile(counterFile, '0');

    const scriptPath = join(root, 'agent.cjs');
    await writeFile(scriptPath, `
      const fs = require('fs');
      const counterFile = '${counterFile.replace(/\\/g, '\\\\')}';
      const counter = parseInt(fs.readFileSync(counterFile, 'utf8'), 10);
      fs.writeFileSync(counterFile, (counter + 1).toString());
      if (counter === 2) {
        fs.writeFileSync('changes.txt', 'divergent data\\n');
      } else {
        fs.writeFileSync('changes.txt', 'majority data\\n');
      }
    `);
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '3', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'CLI should succeed on 2-of-3 majority');
    assert.match(result.stdout, /Consensus reached! 2\/3/);

    const patchStat = await stat(join(root, '.loop-sandbox', 'patches', 'consensus.patch'));
    assert.ok(patchStat.size > 0, 'consensus.patch should be created');

    await rm(counterFile, { force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('loop-swarm handles exit-code-0 no-op majority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  try {
    await setupGit(root);

    const counterFile = join(tmpdir(), 'loop-swarm-counter-' + Math.random().toString().slice(2));
    await writeFile(counterFile, '0');

    const scriptPath = join(root, 'agent.cjs');
    await writeFile(scriptPath, `
      const fs = require('fs');
      const counterFile = '${counterFile.replace(/\\/g, '\\\\')}';
      const counter = parseInt(fs.readFileSync(counterFile, 'utf8'), 10);
      fs.writeFileSync(counterFile, (counter + 1).toString());
      if (counter === 2) {
        fs.writeFileSync('changes.txt', 'some change\\n');
      }
    `);
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '3', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, 'CLI should succeed on no-op majority');
    assert.match(result.stdout, /Consensus reached! 2\/3 agents produced NO changes/);

    await rm(counterFile, { force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

