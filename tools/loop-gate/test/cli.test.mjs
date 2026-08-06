import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist/cli.js');

async function freshGateDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-gate-cli-'));
  await writeFile(
    path.join(dir, 'gate.yaml'),
    'version: 1\ndenylist:\n  - ".env"\n  - "auth/**"\nmaxFiles: 3\nautoMergeAllowlist:\n  - "docs/**"\n',
  );
  return dir;
}

async function freshPromotionDir() {
  const dir = await freshGateDir();
  await writeFile(
    path.join(dir, 'promotion.yaml'),
    `version: 1
authorization: { labels: ["loop:automerge"], minApprovals: 1 }
pullRequest:
  baseBranches: [main]
  requireCleanMerge: true
  requireResolvedThreads: true
  sameRepositoryOnly: true
  maxAttempts: 3
checks: { required: ["drone/pr"] }
deployment: { required: false, environment: test }
testData: { required: false, allowedKinds: [synthetic], requireVersion: false }
e2e: { requiredSuites: [], requireDatasetMatch: false }
manualAcceptance: { mode: never }
`,
  );
  await writeFile(
    path.join(dir, 'evidence.json'),
    JSON.stringify({
      version: 1,
      observedAt: '2026-08-06T08:00:00Z',
      pullRequest: {
        number: 1,
        headSha: 'abc',
        baseBranch: 'main',
        baseRepository: 'o/r',
        headRepository: 'o/r',
        draft: false,
        mergeState: 'CLEAN',
        labels: ['loop:automerge'],
        approvals: 1,
        approvalSha: 'abc',
        changesRequested: false,
        unresolvedThreads: 0,
        attempts: 0,
        riskLevel: 'low',
        changedPaths: ['docs/readme.md'],
      },
      checks: [{ name: 'drone/pr', status: 'success', sha: 'abc' }],
      e2e: [],
    }),
  );
  return dir;
}

async function freshRepairDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-repair-cli-'));
  await writeFile(
    path.join(dir, 'repair.yaml'),
    `version: 1
labels:
  pause: loop-pause-all
  lock: loop:repairing
  bug: bug
  attemptsPrefix: "loop:attempts:"
  priority: [priority:high]
  sensitive: [security]
maxAttempts: 3
sensitivePaths: ["deploy/**"]
`,
  );
  await writeFile(
    path.join(dir, 'evidence.json'),
    JSON.stringify({
      version: 1,
      observedAt: '2026-08-06T08:00:00Z',
      repository: 'o/r',
      pauseIssues: [],
      targets: [{
        type: 'issue',
        number: 7,
        title: 'Reproducible bug',
        updatedAt: '2026-08-01T00:00:00Z',
        labels: ['bug'],
        reproduction: 'confirmed',
      }],
    }),
  );
  return dir;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('cli check allows an in-policy commit', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit', '--paths', 'src/index.ts', '--json'], dir);
  assert.equal(r.status, 0);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.allowed, true);
});

test('cli check escalates on a denylist hit', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit', '--paths', 'auth/login.ts', '--json'], dir);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'denylist');
});

test('cli check escalates auto-merge on a non-allowlisted path', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'auto-merge', '--paths', 'src/index.ts'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /not-allowlisted/);
});

test('cli check allows auto-merge on an allowlisted path', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'auto-merge', '--paths', 'docs/readme.md'], dir);
  assert.equal(r.status, 0);
});

test('cli check rejects an invalid action', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'deploy', '--paths', 'x.ts'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid --action: deploy/);
});

test('cli check rejects --paths that is whitespace/commas only, not silently allowed', async () => {
  const dir = await freshGateDir();
  const whitespaceOnly = runCli(['check', '--action', 'commit', '--paths', ' '], dir);
  assert.equal(whitespaceOnly.status, 1);
  assert.match(whitespaceOnly.stderr, /--paths must contain at least one non-empty path/);

  const commasOnly = runCli(['check', '--action', 'commit', '--paths', ',,,'], dir);
  assert.equal(commasOnly.status, 1);
  assert.match(commasOnly.stderr, /--paths must contain at least one non-empty path/);
});

test('cli check requires --action and --paths', async () => {
  const dir = await freshGateDir();
  const r = runCli(['check', '--action', 'commit'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /check requires --action and --paths/);
});

test('cli check surfaces a missing gate file clearly', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-gate-cli-empty-'));
  const r = runCli(['check', '--action', 'commit', '--paths', 'x.ts'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Gate config not found/);
});

test('cli check honors --gate-file', async () => {
  const dir = await freshGateDir();
  const customPath = path.join(dir, 'custom-gate.yaml');
  await writeFile(customPath, 'version: 1\ndenylist:\n  - "custom/**"\n');
  const r = runCli(['check', '--action', 'commit', '--paths', 'custom/x.ts', '--gate-file', customPath, '--json'], dir);
  assert.equal(r.status, 2);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.trigger, 'denylist');
});

test('cli --help prints usage and exits 0', () => {
  const r = runCli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /loop-gate/);
});

test('cli unknown command exits 1', () => {
  const r = runCli(['bogus']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown command/);
});

test('cli promote allows a PR that satisfies the contract', async () => {
  const dir = await freshPromotionDir();
  const r = runCli(
    ['promote', '--contract', 'promotion.yaml', '--evidence', 'evidence.json', '--json'],
    dir,
  );
  assert.equal(r.status, 0, r.stderr);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.allowed, true);
  assert.equal(decision.stage, 'merge-ready');
});

test('cli promote holds when exact-SHA check evidence is missing', async () => {
  const dir = await freshPromotionDir();
  const file = path.join(dir, 'evidence.json');
  const evidence = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  evidence.pullRequest.headSha = 'new-sha';
  await writeFile(file, JSON.stringify(evidence));
  const r = runCli(['promote', '--contract', 'promotion.yaml', '--evidence', 'evidence.json'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /check-missing/);
});

test('cli promote requires contract and evidence files', async () => {
  const dir = await freshPromotionDir();
  const r = runCli(['promote', '--contract', 'promotion.yaml'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /requires --contract and --evidence/);
});

test('cli repair-plan selects one safe target', async () => {
  const dir = await freshRepairDir();
  const r = runCli(['repair-plan', '--contract', 'repair.yaml', '--evidence', 'evidence.json', '--json'], dir);
  assert.equal(r.status, 0, r.stderr);
  const decision = JSON.parse(r.stdout);
  assert.equal(decision.state, 'selected');
  assert.equal(decision.selected.number, 7);
});

test('cli repair-plan exits 2 when the kill switch is active', async () => {
  const dir = await freshRepairDir();
  const file = path.join(dir, 'evidence.json');
  const evidence = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  evidence.pauseIssues = [99];
  await writeFile(file, JSON.stringify(evidence));
  const r = runCli(['repair-plan', '--contract', 'repair.yaml', '--evidence', 'evidence.json'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /PAUSED/);
});
