import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolveDailyBudgetFromPattern } from '../dist/budget-resolver.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(testDir, '../dist/cli.js');
const onExceedCaptureScript = path.join(testDir, 'fixtures/on-exceed-capture.mjs');
const onExceedIgnoreStdinScript = path.join(testDir, 'fixtures/on-exceed-ignore-stdin.mjs');

async function freshDir() {
  return mkdtemp(path.join(tmpdir(), 'loop-context-cli-daily-'));
}

const stagnationLedger = JSON.stringify({
  goal: 'x',
  attempts: [
    { iteration: 1, action: 'a', outcome: 'failure', error: 'boom' },
    { iteration: 2, action: 'a', outcome: 'failure', error: 'boom' },
    { iteration: 3, action: 'a', outcome: 'failure', error: 'boom' },
  ],
});

function runCli(args, input = stagnationLedger) {
  return spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: 'utf8',
    // Default 1MB is too small once a decision's JSON echoes back a large
    // error string (see the --on-exceed EPIPE regression test below).
    maxBuffer: 20 * 1024 * 1024,
  });
}

test('cli --check trips stagnation with default threshold', () => {
  const r = runCli(['--check', '--json']);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'stagnation');
});

test('cli rejects invalid --stagnation values before running the breaker', () => {
  const r = runCli(['--check', '--stagnation', 'nope', '--json']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--stagnation must be a positive integer/);
});

test('cli rejects invalid --no-progress values', () => {
  const r = runCli(['--check', '--no-progress', '0', '--json']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--no-progress must be a positive integer/);
});

test('cli rejects invalid --max-iterations values', () => {
  const r = runCli(['--check', '--max-iterations', '1.5', '--json']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--max-iterations must be a positive integer/);
});

test('cli rejects a percentage-style --similarity-threshold instead of disabling stagnation', () => {
  // 95 was accepted and meant no two errors could ever match: the same failure
  // repeated forever came back CONTINUE with exit 0.
  for (const value of ['95', '100', '1.5', 'Infinity']) {
    const r = runCli(['--check', '--similarity-threshold', value, '--json']);
    assert.equal(r.status, 1, value);
    assert.equal(r.stdout, '', `${value}: no decision is printed`);
    assert.match(r.stderr, /--similarity-threshold must be a fraction greater than 0 and at most 1/, value);
    assert.match(r.stderr, /stagnation rule would never fire/, value);
  }
  assert.match(runCli(['--check', '--similarity-threshold', '95']).stderr, /If you meant 95%, use 0\.95/);
});

test('cli rejects zero, negative and non-numeric --similarity-threshold', () => {
  for (const value of ['0', '-0.5', 'abc']) {
    const r = runCli(['--check', '--similarity-threshold', value, '--json']);
    assert.equal(r.status, 1, value);
    assert.ok(r.stderr.includes(`got ${value}.`), value);
  }
});

test('cli accepts --similarity-threshold across (0, 1] and still trips stagnation', () => {
  for (const value of ['1', '0.95', '0.5', '0.01']) {
    const r = runCli(['--check', '--similarity-threshold', value, '--json']);
    assert.equal(r.status, 2, value);
    assert.equal(JSON.parse(r.stdout).trigger, 'stagnation', value);
  }
});

test('cli validates --similarity-threshold for --prune too', () => {
  const r = runCli(['--prune', '--similarity-threshold', '85']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /If you meant 85%, use 0\.85/);
});

test('cli rejects missing numeric flag values', () => {
  const r = runCli(['--check', '--stagnation']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--stagnation requires a positive integer value/);
});

const cheapLedger = JSON.stringify({
  goal: 'x',
  attempts: [{ iteration: 1, action: 'a', outcome: 'success', tokensUsed: 100 }],
});

test('cli resolves --token-budget from --budget-from-pattern', () => {
  const r = runCli(
    ['--check', '--budget-from-pattern', 'ci-sweeper', '--budget-level', 'L2', '--json'],
    cheapLedger,
  );
  assert.equal(r.status, 0);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.escalate, false);
});

test('cli --token-budget wins over --budget-from-pattern when both are given', () => {
  const r = runCli(
    ['--check', '--budget-from-pattern', 'ci-sweeper', '--token-budget', '50', '--json'],
    cheapLedger,
  );
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'token-budget');
});

test('cli --budget-from-pattern surfaces loop-cost\'s unknown-pattern error', () => {
  const r = runCli(['--check', '--budget-from-pattern', 'not-a-pattern'], cheapLedger);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown pattern: not-a-pattern/);
});

test('cli --daily-budget-from-pattern escalates once the daily cap is reached', async () => {
  const dir = await freshDir();
  const dailyCap = await resolveDailyBudgetFromPattern({ pattern: 'ci-sweeper', level: 'L2' });
  // Pre-seed today's spend right at the cap so this run's single-token delta tips it over.
  await writeFile(
    path.join(dir, 'daily-spend.ci-sweeper.json'),
    JSON.stringify({ date: new Date().toISOString().slice(0, 10), tokensUsedToday: dailyCap }),
  );

  const r = runCli(
    [
      '--check', '--daily-budget-from-pattern', 'ci-sweeper', '--budget-level', 'L2',
      '--daily-state-dir', dir, '--json',
    ],
    cheapLedger,
  );
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'daily-budget');
});

test('cli --daily-budget-from-pattern does not override an existing per-run trigger', async () => {
  const dir = await freshDir();
  const dailyCap = await resolveDailyBudgetFromPattern({ pattern: 'ci-sweeper', level: 'L2' });
  await writeFile(
    path.join(dir, 'daily-spend.ci-sweeper.json'),
    JSON.stringify({ date: new Date().toISOString().slice(0, 10), tokensUsedToday: dailyCap * 10 }),
  );

  const r = runCli([
    '--check', '--daily-budget-from-pattern', 'ci-sweeper', '--budget-level', 'L2',
    '--daily-state-dir', dir, '--json',
  ]);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'stagnation');
});

test('cli --on-exceed pipes the escalation decision to the script as JSON', async () => {
  const dir = await freshDir();
  const outFile = path.join(dir, 'captured.json');

  const r = runCli(['--check', '--on-exceed', `node ${onExceedCaptureScript} ${outFile}`, '--json']);
  assert.equal(r.status, 2);

  const captured = JSON.parse(await readFile(outFile, 'utf8'));
  assert.equal(captured.trigger, 'stagnation');
  assert.equal(captured.escalate, true);
});

test('cli --on-exceed is not invoked when the run continues', async () => {
  const dir = await freshDir();
  const outFile = path.join(dir, 'should-not-exist.json');

  const r = runCli(
    ['--check', '--on-exceed', `node ${onExceedCaptureScript} ${outFile}`, '--json'],
    cheapLedger,
  );
  assert.equal(r.status, 0);
  await assert.rejects(() => readFile(outFile, 'utf8'));
});

test('cli --on-exceed does not crash when the hook script exits without reading stdin', async () => {
  const dir = await freshDir();
  const outFile = path.join(dir, 'ran.marker');

  // A large first-line error survives errorSignature() unshortened, so the
  // piped decision JSON is big enough to exceed the OS pipe buffer -- this
  // makes the write-after-close failure (EPIPE on POSIX, EOF on Windows)
  // land reliably instead of racing the hook process's own startup time.
  const bigError = 'e'.repeat(5_000_000);
  const bigLedger = JSON.stringify({
    goal: 'x',
    attempts: [
      { iteration: 1, action: 'a', outcome: 'failure', error: bigError },
      { iteration: 2, action: 'a', outcome: 'failure', error: bigError },
      { iteration: 3, action: 'a', outcome: 'failure', error: bigError },
    ],
  });

  const r = runCli(
    ['--check', '--on-exceed', `node ${onExceedIgnoreStdinScript} ${outFile}`, '--json'],
    bigLedger,
  );

  assert.equal(r.status, 2, `expected a clean escalation exit, not a crash. stderr: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /Uncaught|EPIPE|EOF/);
  assert.equal(await readFile(outFile, 'utf8'), 'ran');
});
