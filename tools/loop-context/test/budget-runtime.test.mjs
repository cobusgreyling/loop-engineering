import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resolverUrl = new URL('../dist/budget-resolver.js', import.meta.url).href;
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
// Windows environment keys are case-insensitive; do not leave a second Path key.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'),
);
env.PATH = '';

async function freshDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-context-budget-runtime-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

for (const resolver of ['resolveTokenBudgetFromPattern', 'resolveDailyBudgetFromPattern']) {
  test(`${resolver} works without node on PATH`, async (t) => {
    const cwd = await freshDir(t);
    const source = `
      import { ${resolver} } from ${JSON.stringify(resolverUrl)};
      console.log(await ${resolver}({ pattern: 'ci-sweeper', level: 'L2' }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd, env, encoding: 'utf8', timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const budget = Number(result.stdout.trim());
    assert.ok(Number.isFinite(budget) && budget > 0, result.stdout);
  });
}

for (const [flag, trigger] of [
  ['--budget-from-pattern', 'token-budget'],
  ['--daily-budget-from-pattern', 'daily-budget'],
]) {
  test(`cli ${flag} enforces its budget without node on PATH`, async (t) => {
    const cwd = await freshDir(t);
    const input = JSON.stringify({
      goal: 'stop an over-budget run',
      attempts: [{ iteration: 1, action: 'check', outcome: 'success', tokensUsed: 1_000_000_000 }],
    });
    const result = spawnSync(process.execPath, [
      cli, '--check', flag, 'ci-sweeper', '--budget-level', 'L2',
      '--daily-state-dir', cwd, '--json',
    ], { cwd, env, input, encoding: 'utf8', timeout: 10_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 2, result.stderr);
    const decision = JSON.parse(result.stdout);
    assert.equal(decision.escalate, true);
    assert.equal(decision.trigger, trigger);
  });
}
