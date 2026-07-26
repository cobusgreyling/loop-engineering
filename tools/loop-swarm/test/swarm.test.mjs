import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

test('loop-swarm run handles simple deterministic command', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loop-swarm-test-'));
  
  try {
    spawnSync('git', ['init'], { cwd: root });
    spawnSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: root });

    const scriptPath = join(root, 'agent.cjs');
    await writeFile(scriptPath, "require('fs').writeFileSync('changes.txt', 'swarm data\\n');");

    const cliUrl = new URL('../dist/cli.js', import.meta.url);
    const cliPath = fileURLToPath(cliUrl);
    
    const result = spawnSync('node', [cliPath, 'run', '--count', '2', '--', 'node', scriptPath], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.match(result.stdout, /Consensus reached! 2\/2/);
    assert.strictEqual(result.status, 0);

  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
