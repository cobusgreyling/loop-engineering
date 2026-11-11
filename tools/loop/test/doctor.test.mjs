import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const AUDIT = { score: 80, level: 'L3', assessment: 'Healthy control', recommendations: [] };
const SYNC = { score: 100, level: 'healthy', issues: [], suggestions: [] };

// Run the real doctor CLI against isolated sibling CLIs. Neither package
// resolution nor these fault cases can fall back to npx or the network.
async function fixture(t, responses = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'loop-doctor-checks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  const cli = path.join(root, 'tools/loop/dist/cli.js');
  await cp(DIST, path.dirname(cli), { recursive: true });
  const target = path.join(root, 'project');
  await mkdir(target);
  for (const [name, content] of Object.entries({
    'STATE.md': '# State\n',
    'LOOP.md': '# Loop\nUpdate STATE.md after each run.\n',
    'loop-budget.md': 'Max tokens/day: 100000\n',
    'loop-run-log.md': '# Runs\n',
  })) {
    await writeFile(path.join(target, name), content);
  }
  for (const [id, healthy] of [['audit', AUDIT], ['sync', SYNC]]) {
    const { stdout = JSON.stringify(healthy), code = 0, stderr = '' } = responses[id] ?? {};
    const entry = path.join(root, `tools/loop-${id}/dist/cli.js`);
    await mkdir(path.dirname(entry), { recursive: true });
    await writeFile(entry, [
      `process.stdout.write(${JSON.stringify(stdout)});`,
      `process.stderr.write(${JSON.stringify(stderr)});`,
      `process.exitCode = ${code};`,
    ].join('\n'));
  }
  const init = path.join(root, 'tools/loop-init/dist/cli.js');
  await mkdir(path.dirname(init), { recursive: true });
  await writeFile(init, 'console.log("fixture init complete");\n');
  return { root, cli, target };
}

function runDoctor({ cli, target }, json = true) {
  return spawnSync(process.execPath, [cli, 'doctor', target, ...(json ? ['--json'] : [])], {
    encoding: 'utf8', timeout: 10_000,
  });
}

function assertBlocked(result, diagnostic) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.severity, 'blocked');
  assert.equal(report.exitCode, 2);
  assert.ok(report.notes.some(note => diagnostic.test(note)), JSON.stringify(report.notes));
  assert.ok(report.actions.some(action => /check/i.test(action.text)));
  assert.ok(report.actions.length <= 3);
  return report;
}

test('doctor keeps valid healthy checks healthy', async t => {
  const result = runDoctor(await fixture(t));
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.severity, 'healthy');
  assert.equal(report.ready.score, 80);
  assert.equal(report.sync.score, 100);
  assert.deepEqual(report.notes, []);
});

for (const tool of ['audit', 'sync']) {
  const healthy = tool === 'audit' ? AUDIT : SYNC;
  const cases = [
    ['execution error', { stdout: '', code: 1, stderr: 'synthetic dependency failure' }],
    ['empty success output', { stdout: '' }],
    ['invalid JSON', { stdout: 'not JSON' }],
    ['missing score', { stdout: JSON.stringify({ level: healthy.level }) }],
    ['missing level', { stdout: JSON.stringify({ ...healthy, level: undefined }) }],
    ['unknown level', { stdout: JSON.stringify({ ...healthy, level: 'unknown' }) }],
    ['out-of-range score', { stdout: JSON.stringify({ ...healthy, score: 101 }) }],
    ['unexpected exit after valid JSON', { stdout: JSON.stringify(healthy), code: 7, stderr: 'synthetic npm warning' }],
  ];
  for (const [name, response] of cases) {
    test(`doctor blocks ${tool} ${name}`, async t => {
      const report = assertBlocked(runDoctor(await fixture(t, { [tool]: response })), new RegExp(`loop-${tool}`));
      assert.equal(report[tool === 'audit' ? 'ready' : 'sync'].score, null);
      assert.equal(report[tool === 'audit' ? 'sync' : 'ready'].score, tool === 'audit' ? 100 : 80);
      if (name === 'unexpected exit after valid JSON') {
        assert.ok(report.notes.some(note => /exited 7 \(expected 0\): synthetic npm warning/.test(note)));
      }
    });
  }
}

test('doctor blocks when both checks fail and retains both diagnostics', async t => {
  const report = assertBlocked(runDoctor(await fixture(t, {
    audit: { stdout: '', code: 1, stderr: 'audit failed' },
    sync: { stdout: '', code: 1, stderr: 'sync failed' },
  })), /loop-audit/);
  assert.ok(report.notes.some(note => /loop-sync/.test(note)));
});

test('doctor blocks a sync report without its issue list', async t => {
  assertBlocked(runDoctor(await fixture(t, {
    sync: { stdout: JSON.stringify({ score: 100, level: 'healthy' }) },
  })), /loop-sync/);
});

test('doctor does not accept an execution-error exit with a healthy report', async t => {
  for (const [tool, report] of [['audit', AUDIT], ['sync', SYNC]]) {
    assertBlocked(runDoctor(await fixture(t, {
      [tool]: { stdout: JSON.stringify(report), code: 1 },
    })), new RegExp(`loop-${tool}`));
  }
});

for (const [name, tool, report, code] of [
  ['high audit exits 2', 'audit', AUDIT, 2],
  ['low audit exits 0', 'audit', { ...AUDIT, score: 20, level: 'L0' }, 0],
  ['critical sync exits 0', 'sync', { ...SYNC, score: 20, level: 'critical' }, 0],
  ['warning sync exits 1', 'sync', { ...SYNC, score: 60, level: 'warning' }, 1],
]) {
  test(`doctor rejects a mismatched domain exit: ${name}`, async t => {
    const actual = assertBlocked(runDoctor(await fixture(t, {
      [tool]: { stdout: JSON.stringify(report), code },
    })), new RegExp(`loop-${tool} exited ${code} \\(expected`));
    assert.equal(actual[tool === 'audit' ? 'ready' : 'sync'].score, null);
  });
}

for (const [name, responses, code, severity] of [
  ['low audit score', { audit: { stdout: JSON.stringify({ ...AUDIT, score: 20, level: 'L0' }), code: 2 } }, 2, 'blocked'],
  ['audit warning', { audit: { stdout: JSON.stringify({ ...AUDIT, score: 50, level: 'L1' }) } }, 1, 'warning'],
  ['sync warning', { sync: { stdout: JSON.stringify({ ...SYNC, score: 60, level: 'warning' }), code: 2 } }, 1, 'warning'],
  ['critical sync', { sync: { stdout: JSON.stringify({ ...SYNC, score: 20, level: 'critical' }), code: 1 } }, 2, 'blocked'],
]) {
  test(`doctor preserves valid ${name} results and domain exit codes`, async t => {
    const result = runDoctor(await fixture(t, responses));
    assert.equal(result.status, code, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.severity, severity);
    assert.notEqual(report.ready.score, null);
    assert.notEqual(report.sync.score, null);
    assert.deepEqual(report.notes, []);
  });
}

test('doctor still accepts a banner before a valid JSON report', async t => {
  const result = runDoctor(await fixture(t, {
    audit: { stdout: `Audit banner\n${JSON.stringify(AUDIT)}` },
  }));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).ready.score, 80);
});

test('doctor shows failed checks in human output without saying there are no blockers', async t => {
  const result = runDoctor(await fixture(t, {
    audit: { stdout: '', code: 1, stderr: 'synthetic dependency failure' },
  }), false);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stdout, /BLOCKED/);
  assert.match(result.stdout, /synthetic dependency failure/);
  assert.doesNotMatch(result.stdout, /No blockers/);
});

test('doctor emits a blocked JSON report when child processes cannot start', async t => {
  const { root, cli, target } = await fixture(t);
  const bootstrap = path.join(root, 'spawn-error.mjs');
  await writeFile(bootstrap, [
    `import { pathToFileURL } from 'node:url';`,
    `process.execPath = ${JSON.stringify(path.join(root, 'missing-node'))};`,
    `process.argv = [process.argv[0], ${JSON.stringify(cli)}, 'doctor', ${JSON.stringify(target)}, '--json'];`,
    `await import(pathToFileURL(${JSON.stringify(cli)}).href);`,
  ].join('\n'));
  const result = spawnSync(process.execPath, [bootstrap], { encoding: 'utf8', timeout: 10_000 });
  const report = assertBlocked(result, /loop-audit.*ENOENT/);
  assert.ok(report.notes.some(note => /loop-sync.*ENOENT/.test(note)));
});

for (const failed of [false, true]) {
  test(`wizard inherits doctor's ${failed ? 'failed-check' : 'healthy'} result`, async t => {
    const { cli, target } = await fixture(t, failed
      ? { audit: { stdout: '', code: 1, stderr: 'synthetic dependency failure' } }
      : {});
    const result = spawnSync(process.execPath, [
      cli, 'wizard', '--yes', '--pattern', 'daily-triage', '--tool', 'codex', target,
    ], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, failed ? 2 : 0, result.stderr || result.stdout);
    assert.match(result.stdout, /fixture init complete/);
    assert.match(result.stdout, failed ? /Status:.*BLOCKED/ : /Status:.*HEALTHY/);
  });
}
