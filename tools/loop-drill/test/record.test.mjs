import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildGroups, fingerprint, guardrailOf, mergeRecord, writeRecord, RECORD_FILE } from '../dist/record.js';

const exec = promisify(execFile);
const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const GATE = 'version: 1\ndenylist:\n  - "**/.env"\n  - "**/secrets/**"\nmaxFiles: 10\n';

const result = (id, outcome = 'passed', direction = 'sensitivity', detail) => ({
  id,
  name: id,
  failureMode: 'Over-Reach (Wrong Scope)',
  direction,
  outcome,
  expected: 'x',
  actual: 'y',
  ...(detail ? { detail } : {}),
});

async function withDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'loop-drill-record-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('record', () => {
  test('fingerprint is sha256 of the LF-normalised file (vector shared with loop-audit)', () => {
    const vector = 'a79338c9d44fec8fe07da24a3766aaf4e32281bd5c73628e0798d59944d1040e';
    assert.equal(fingerprint('version: 1\ndenylist:\n  - "**/.env"\n'), vector);
    assert.equal(fingerprint('version: 1\r\ndenylist:\r\n  - "**/.env"\r\n'), vector);
  });

  test('guardrailOf maps drill ids to their guardrail', () => {
    assert.equal(guardrailOf('gate.denylist[**/.env]'), 'gate');
    assert.equal(guardrailOf('gate'), 'gate');
    assert.equal(guardrailOf('breaker.token-budget'), 'breaker');
    assert.equal(guardrailOf('verifier.mutant[strict-equality-flip]'), 'verifier');
    assert.equal(guardrailOf('injection.hidden-comment'), 'injection');
  });

  test('buildGroups groups by selected guardrail and keeps detail only for non-passing drills', () => {
    const groups = buildGroups(
      [
        { ...result('gate.denylist[**/.env]'), detail: 'noise' },
        result('gate.benign', 'passed', 'specificity'),
        result('breaker.token-budget', 'skipped', 'sensitivity', 'No tokenBudget configured'),
      ],
      ['gate', 'breaker', 'verifier'],
      { recordedAt: '2026-09-28T00:00:00.000Z', gateFile: 'gate.yaml', gateSha256: 'abc' },
    );
    assert.deepEqual(Object.keys(groups), ['gate', 'breaker'], 'no empty group for a guardrail with no results');
    assert.deepEqual(groups.gate.input, { file: 'gate.yaml', sha256: 'abc' });
    assert.equal(groups.gate.results[0].detail, undefined);
    assert.equal(groups.breaker.results[0].detail, 'No tokenBudget configured');
    assert.equal(groups.breaker.input, undefined);
    assert.deepEqual(Object.keys(groups.gate.results[0]).sort(), ['direction', 'failureMode', 'id', 'outcome']);
  });

  test('the verifier group records its command and mutation score', () => {
    const groups = buildGroups(
      [result('verifier.control', 'passed', 'specificity'), result('verifier.mutant[x]')],
      ['verifier'],
      { recordedAt: 't', verifierCommand: 'npm test', mutationScore: 1 },
    );
    assert.deepEqual(groups.verifier.input, { command: 'npm test' });
    assert.equal(groups.verifier.mutationScore, 1);
  });

  test('mergeRecord replaces the groups drilled this run and keeps the rest', () => {
    const existing = {
      schema: 1,
      guardrails: { verifier: { recordedAt: 'old', results: [] }, gate: { recordedAt: 'old', results: [] } },
    };
    const merged = mergeRecord(existing, { gate: { recordedAt: 'new', results: [] }, breaker: { recordedAt: 'new', results: [] } });
    assert.deepEqual(Object.keys(merged.guardrails), ['breaker', 'gate', 'verifier'], 'sorted for stable diffs');
    assert.equal(merged.guardrails.gate.recordedAt, 'new');
    assert.equal(merged.guardrails.verifier.recordedAt, 'old');
    assert.equal(merged.schema, 1);
  });

  test('mergeRecord starts fresh over a missing or foreign record', () => {
    for (const existing of [undefined, null, { schema: 99, guardrails: { gate: {} } }, 'text']) {
      const merged = mergeRecord(existing, { gate: { recordedAt: 'new', results: [] } });
      assert.deepEqual(Object.keys(merged.guardrails), ['gate']);
    }
  });

  test('writeRecord overwrites an unreadable file rather than failing', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, RECORD_FILE), '{ corrupt');
      await writeRecord(dir, { gate: { recordedAt: 'new', results: [] } });
      const saved = JSON.parse(await readFile(path.join(dir, RECORD_FILE), 'utf8'));
      assert.deepEqual(Object.keys(saved.guardrails), ['gate']);
    });
  });
});

describe('loop-drill --record', () => {
  test('writes gate and breaker proof bound to the gate.yaml it drilled', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, 'gate.yaml'), GATE.replace(/\n/g, '\r\n'));
      const { stdout } = await exec(process.execPath, [CLI, dir, '--record']).catch((err) => err);
      assert.match(stdout, /Recorded gate, breaker to loop-drill\.json/);

      const saved = JSON.parse(await readFile(path.join(dir, RECORD_FILE), 'utf8'));
      assert.equal(saved.schema, 1);
      assert.deepEqual(saved.guardrails.gate.input, { file: 'gate.yaml', sha256: fingerprint(GATE) }, 'CRLF on disk, LF fingerprint');
      const gate = saved.guardrails.gate.results;
      assert.ok(gate.some((r) => r.direction === 'sensitivity' && r.outcome === 'passed'));
      assert.ok(gate.some((r) => r.id === 'gate.benign' && r.outcome === 'passed'));
      assert.ok(saved.guardrails.breaker.results.length > 0);
    });
  });

  test('records a gate loop-gate refuses as a skip with the reason', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, 'gate.yaml'), 'version: 1\ndenylist: nope\n');
      await exec(process.execPath, [CLI, dir, '--only', 'gate', '--record']).catch((err) => err);
      const saved = JSON.parse(await readFile(path.join(dir, RECORD_FILE), 'utf8'));
      const [only] = saved.guardrails.gate.results;
      assert.equal(only.outcome, 'skipped');
      assert.match(only.detail, /denylist/);
      assert.equal(saved.guardrails.gate.input.sha256, fingerprint('version: 1\ndenylist: nope\n'));
    });
  });

  test('--only replaces one guardrail and keeps the others', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, 'gate.yaml'), GATE);
      await exec(process.execPath, [CLI, dir, '--record']).catch((err) => err);
      const first = JSON.parse(await readFile(path.join(dir, RECORD_FILE), 'utf8'));
      await exec(process.execPath, [CLI, dir, '--only', 'breaker', '--record']).catch((err) => err);
      const second = JSON.parse(await readFile(path.join(dir, RECORD_FILE), 'utf8'));
      assert.deepEqual(second.guardrails.gate, first.guardrails.gate);
      assert.notEqual(second.guardrails.breaker.recordedAt, undefined);
    });
  });

  test('--json --record keeps stdout parseable', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, 'gate.yaml'), GATE);
      const { stdout, stderr } = await exec(process.execPath, [CLI, dir, '--json', '--record']).catch((err) => err);
      assert.doesNotThrow(() => JSON.parse(stdout));
      assert.match(stderr, /Recorded gate, breaker/);
    });
  });

  test('without --record nothing is written', async () => {
    await withDir(async (dir) => {
      await writeFile(path.join(dir, 'gate.yaml'), GATE);
      await exec(process.execPath, [CLI, dir]).catch((err) => err);
      await assert.rejects(readFile(path.join(dir, RECORD_FILE), 'utf8'));
    });
  });
});
