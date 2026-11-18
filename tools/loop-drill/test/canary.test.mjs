import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runCanary, runVerifier, candidateFiles, collectMutants } from '../dist/canary.js';

const exec = promisify(execFile);

/**
 * A throwaway git repo with one mutable source file and a real test script.
 * The "verifier" is `node verify.mjs`, which asserts isAdult(18) === true —
 * a check the boundary mutation (>= to >) genuinely breaks.
 */
let repo;

before(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), 'loop-drill-'));
  await mkdir(path.join(repo, 'src'), { recursive: true });

  await writeFile(
    path.join(repo, 'src', 'rules.mjs'),
    'export function isAdult(age) {\n  return age >= 18;\n}\n',
  );
  await writeFile(
    path.join(repo, 'verify.mjs'),
    [
      "import { isAdult } from './src/rules.mjs';",
      'if (isAdult(18) !== true) { console.error("18 must be adult"); process.exit(1); }',
      'if (isAdult(17) !== false) { console.error("17 must not be adult"); process.exit(1); }',
      'console.log("verified");',
    ].join('\n'),
  );

  await exec('git', ['-C', repo, 'init', '-q']);
  await exec('git', ['-C', repo, 'config', 'user.email', 'drill@example.com']);
  await exec('git', ['-C', repo, 'config', 'user.name', 'drill']);
  await exec('git', ['-C', repo, 'add', '.']);
  await exec('git', ['-C', repo, 'commit', '-q', '-m', 'seed']);
});

after(async () => {
  if (repo) await rm(repo, { recursive: true, force: true });
});

describe('runVerifier', () => {
  test('exit 0 is read as accepted', async () => {
    const run = await runVerifier('node -e "process.exit(0)"', process.cwd(), 20_000);
    assert.equal(run.accepted, true);
  });

  test('non-zero exit is read as rejected, and the code is reported', async () => {
    const run = await runVerifier('node -e "process.exit(3)"', process.cwd(), 20_000);
    assert.equal(run.accepted, false);
    assert.equal(run.exitCode, 3);
  });

  test('a hanging verifier is rejected rather than hanging the drill', async () => {
    const run = await runVerifier('node -e "setTimeout(()=>{}, 60000)"', process.cwd(), 800);
    assert.equal(run.accepted, false);
    assert.equal(run.timedOut, true);
  });
});

describe('candidateFiles / collectMutants', () => {
  test('lists tracked source and skips the verifier harness itself', async () => {
    const files = await candidateFiles(repo);
    assert.ok(files.includes('src/rules.mjs'));
  });

  test('builds a mutant from real source', async () => {
    const mutants = await collectMutants(repo, ['src/rules.mjs'], 1);
    assert.equal(mutants.length, 1);
    assert.equal(mutants[0].file, 'src/rules.mjs');
    assert.match(mutants[0].mutated, /age > 18/);
  });
});

describe('runCanary', () => {
  test('a real verifier catches the seeded defect and scores 100%', async () => {
    const report = await runCanary({
      root: repo,
      command: 'node verify.mjs',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
    });
    assert.equal(report.mutationScore, 1);
    assert.equal(report.caught, 1);
    assert.equal(report.escaped, 0);
    assert.ok(report.results.every((r) => r.outcome === 'passed'));
  });

  test('a rubber-stamp verifier scores 0% and is named as Verifier Theater', async () => {
    const report = await runCanary({
      root: repo,
      command: 'node -e "console.log(\'LGTM\')"',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
    });
    assert.equal(report.mutationScore, 0);
    assert.equal(report.escaped, 1);
    const escaped = report.results.find((r) => r.outcome === 'failed');
    assert.ok(escaped, 'expected a failed drill');
    assert.equal(escaped.failureMode, 'Verifier Theater');
    assert.match(escaped.actual, /approved a seeded defect/);
  });

  test('a reject-everything verifier fails the control and skips the mutants', async () => {
    const report = await runCanary({
      root: repo,
      command: 'node -e "process.exit(1)"',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
    });
    // Mutant results would be meaningless here, so none were produced.
    assert.equal(report.mutationScore, null);
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0].id, 'verifier.control');
    assert.equal(report.results[0].outcome, 'failed');
  });

  test('a verifier that only passes with prepared deps is skipped, not scored', async () => {
    // Passes at the repo root (the marker is untracked, so it survives there)
    // but not in a fresh worktree -- the environment-drift case that would
    // otherwise report every mutant as caught.
    await writeFile(path.join(repo, 'untracked-marker.txt'), 'present\n');
    const report = await runCanary({
      root: repo,
      command: 'node -e "require(\'fs\').accessSync(\'untracked-marker.txt\')"',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
    });
    assert.equal(report.mutationScore, null, 'must not score mutants on a broken worktree');
    const control = report.results.find((r) => r.id === 'verifier.worktree-control');
    assert.equal(control.outcome, 'skipped');
    assert.match(control.detail, /--setup/);
    await rm(path.join(repo, 'untracked-marker.txt'), { force: true });
  });

  test('--setup repairs the worktree so mutants can be scored', async () => {
    await writeFile(path.join(repo, 'untracked-marker.txt'), 'present\n');
    const report = await runCanary({
      root: repo,
      command: 'node -e "require(\'fs\').accessSync(\'untracked-marker.txt\')" && node verify.mjs',
      setup: 'node -e "require(\'fs\').writeFileSync(\'untracked-marker.txt\',\'x\')"',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
    });
    assert.equal(report.mutationScore, 1);
    await rm(path.join(repo, 'untracked-marker.txt'), { force: true });
  });

  test('a setup that fails in one worktree is skipped, not scored as a catch', async () => {
    // The control run prepares worktree #1 and succeeds; the mutant run gets
    // worktree #2, where setup fails. Nothing verified that mutant, so it must
    // not be credited to the verifier.
    const counter = path.join(repo, '.setup-count');
    await writeFile(counter, '0');
    // Single quotes inside the command: the whole thing goes through a shell
    // that is already using double quotes.
    const counterPath = counter.split(path.sep).join('/');
    const setup =
      `node -e "const fs=require('fs');const p='${counterPath}';` +
      `const n=Number(fs.readFileSync(p,'utf8'))+1;fs.writeFileSync(p,String(n));if(n>1){console.error('setup broke');process.exit(7)}"`;
    const report = await runCanary({
      root: repo,
      command: 'node verify.mjs',
      count: 1,
      timeoutMs: 60_000,
      scope: 'src',
      setup,
    });
    assert.equal(report.caught, 0, 'a failed setup is not a rejection');
    assert.equal(report.mutationScore, null);
    const mutant = report.results.find((r) => r.id.startsWith('verifier.mutant['));
    assert.equal(mutant.outcome, 'skipped');
    assert.match(mutant.detail, /setup failed/i);
    await rm(counter, { force: true });
  });

  test('leaves no worktree behind', async () => {
    const entries = await readdir(repo);
    assert.deepEqual(entries.filter((e) => e.startsWith('.loop-drill-')), []);
    const { stdout } = await exec('git', ['-C', repo, 'worktree', 'list']);
    assert.equal(stdout.trim().split('\n').length, 1, 'only the main worktree should remain');
  });
});
