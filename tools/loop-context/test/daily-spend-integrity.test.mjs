import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { recordDailySpend, todayUTC } from '../dist/daily-spend.js';
import { resolveDailyBudgetFromPattern } from '../dist/budget-resolver.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const dailyModule = new URL('../dist/daily-spend.js', import.meta.url).href;
const pattern = 'ci-sweeper';

async function fixture(fn, content) {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-spend-integrity-'));
  const file = path.join(dir, `daily-spend.${pattern}.json`);
  try {
    if (content !== undefined) await writeFile(file, content);
    return await fn({ dir, file });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function state(tokensUsedToday = 100, date = todayUTC()) {
  return JSON.stringify({ date, tokensUsedToday });
}

function runCheck(dir, tokensUsed = 1) {
  return spawnSync(process.execPath, [
    cli, '--check', '--daily-budget-from-pattern', pattern,
    '--daily-state-dir', dir, '--json',
  ], {
    input: JSON.stringify({
      goal: 'Synthetic daily spend check',
      attempts: [{ iteration: 1, action: 'inspect', outcome: 'success', tokensUsed }],
    }),
    encoding: 'utf8', timeout: 10_000,
  });
}

const damagedStates = [
  ['truncated JSON', () => '{"date":'],
  ['empty file', () => ''],
  ['null root', () => 'null'],
  ['array root', () => '[]'],
  ['missing date', () => JSON.stringify({ tokensUsedToday: 100 })],
  ['noncanonical date', () => state(100, '2026/11/11')],
  ['impossible calendar date', () => state(100, '2026-02-30')],
  ['missing total', () => JSON.stringify({ date: todayUTC() })],
  ['string total', () => state('100')],
  ['negative total', () => state(-1)],
  ['null total', () => state(null)],
  ['nonfinite JSON number', () => `{"date":"${todayUTC()}","tokensUsedToday":1e309}`],
];

for (const [name, content] of damagedStates) {
  test(`daily spend rejects ${name} and preserves the original bytes`, async () => {
    const raw = content();
    await fixture(async ({ dir, file }) => {
      await assert.rejects(recordDailySpend(dir, pattern, 1), /Invalid daily spend state/);
      assert.equal(await readFile(file, 'utf8'), raw);
    }, raw);
  });
}

for (const [name, delta] of [
  ['negative', -1], ['string', '1'], ['NaN', NaN], ['infinite', Infinity], ['missing', undefined],
]) {
  test(`daily spend rejects a ${name} delta without changing accumulated spend`, async () => {
    const raw = state();
    await fixture(async ({ dir, file }) => {
      await assert.rejects(recordDailySpend(dir, pattern, delta), /Token increment.*finite.*non-negative/);
      assert.equal(await readFile(file, 'utf8'), raw);
    }, raw);
  });
}

test('daily spend rejects an overflowing total before it can persist null', async () => {
  const raw = state(Number.MAX_VALUE);
  await fixture(async ({ dir, file }) => {
    await assert.rejects(recordDailySpend(dir, pattern, Number.MAX_VALUE), /daily.*total.*finite/i);
    assert.equal(await readFile(file, 'utf8'), raw);
  }, raw);
});

test('daily spend keeps zero and fractional finite deltas valid', async () => {
  await fixture(async ({ dir }) => {
    assert.equal((await recordDailySpend(dir, pattern, 0)).tokensUsedToday, 0);
    assert.equal((await recordDailySpend(dir, pattern, 0.5)).tokensUsedToday, 0.5);
  });
});

test('a corrupt state does not strand the lock; restoring valid state allows accumulation', async () => {
  await fixture(async ({ dir, file }) => {
    await assert.rejects(recordDailySpend(dir, pattern, 1), /Invalid daily spend state/);
    await assert.rejects(access(path.join(dir, `.daily-spend.${pattern}.lock`)), { code: 'ENOENT' });
    await writeFile(file, state(500));
    assert.equal((await recordDailySpend(dir, pattern, 2)).tokensUsedToday, 502);
  }, '{');
});

test('a read failure is reported rather than treated as a missing file', async () => {
  const raw = state();
  await fixture(async ({ dir, file }) => {
    // Inject only a read denial in a child process. Writes remain possible,
    // making a swallowed read error observable without OS permission tricks.
    const script = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const original = fs.promises.readFile;
      fs.promises.readFile = async function (file, ...args) {
        if (String(file) === ${JSON.stringify(file)}) {
          throw Object.assign(new Error('EACCES: injected read denial'), { code: 'EACCES' });
        }
        return original.call(this, file, ...args);
      };
      syncBuiltinESMExports();
      const { recordDailySpend } = await import(${JSON.stringify(dailyModule)});
      try {
        await recordDailySpend(${JSON.stringify(dir)}, ${JSON.stringify(pattern)}, 1);
        process.exitCode = 3;
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
      }
    `;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(r.status, 1, r.stderr || r.stdout);
    assert.match(r.stderr, /Cannot read daily spend state.*EACCES/);
    assert.equal(await readFile(file, 'utf8'), raw);
  }, raw);
});

for (const [name, raw] of [
  ['truncated JSON', '{"date":'],
  ['missing counter', JSON.stringify({ date: todayUTC() })],
]) {
  test(`CLI fails without a continue decision or overwrite for ${name}`, async () => {
    await fixture(async ({ dir, file }) => {
      const r = runCheck(dir);
      assert.equal(r.error, undefined);
      assert.equal(r.status, 1, r.stderr || r.stdout);
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /loop-context failed: Invalid daily spend state/);
      assert.equal(await readFile(file, 'utf8'), raw);
    }, raw);
  });
}

test('CLI rejects a negative newest-attempt delta without reducing the saved total', async () => {
  const raw = state();
  await fixture(async ({ dir, file }) => {
    const r = runCheck(dir, -1);
    assert.equal(r.status, 1, r.stderr || r.stdout);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /Token increment.*finite.*non-negative/);
    assert.equal(await readFile(file, 'utf8'), raw);
  }, raw);
});

test('CLI still creates first-run state and continues below the cap', async () => {
  await fixture(async ({ dir, file }) => {
    const r = runCheck(dir);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(JSON.parse(r.stdout).shouldContinue, true);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { date: todayUTC(), tokensUsedToday: 1 });
  });
});

test('CLI still escalates at the daily cap with valid state', async () => {
  const cap = await resolveDailyBudgetFromPattern({ pattern });
  await fixture(async ({ dir, file }) => {
    const r = runCheck(dir);
    assert.equal(r.status, 2, r.stderr || r.stdout);
    assert.equal(JSON.parse(r.stdout).trigger, 'daily-budget');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).tokensUsedToday, cap);
  }, state(cap - 1));
});

test('CLI still rolls a valid stale UTC date over to a new total', async () => {
  await fixture(async ({ dir, file }) => {
    const r = runCheck(dir);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { date: todayUTC(), tokensUsedToday: 1 });
  }, state(999_999, '2000-01-01'));
});

test('a corrupt daily state exits 1 before a per-run escalation or its hook', async () => {
  const raw = '{';
  await fixture(async ({ dir, file }) => {
    const r = spawnSync(process.execPath, [
      cli, '--check', '--daily-budget-from-pattern', pattern,
      '--daily-state-dir', dir, '--json', '--on-exceed', 'echo unexpected-escalation-hook',
    ], {
      input: JSON.stringify({
        goal: 'Synthetic stagnation plus corrupt state',
        attempts: [1, 2, 3].map(iteration => ({
          iteration, action: 'inspect', outcome: 'failure', error: 'same failure', tokensUsed: 1,
        })),
      }),
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(r.status, 1, r.stderr || r.stdout);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /Invalid daily spend state/);
    assert.doesNotMatch(r.stderr, /unexpected-escalation-hook/);
    assert.equal(await readFile(file, 'utf8'), raw);
  }, raw);
});
