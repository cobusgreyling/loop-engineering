import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  evaluatePromotion,
  loadPromotionContract,
  loadPromotionEvidence,
  parsePromotionContract,
  parsePromotionEvidence,
} from '../dist/promotion.js';

const sha = 'abc123';

const contract = {
  version: 1,
  authorization: { labels: ['loop:automerge'], minApprovals: 1 },
  pullRequest: {
    baseBranches: ['main'],
    requireCleanMerge: true,
    requireResolvedThreads: true,
    sameRepositoryOnly: true,
    maxAttempts: 3,
  },
  checks: { required: ['drone/pr'] },
  deployment: { required: true, environment: 'test', maxAgeHours: 24 },
  testData: { required: true, allowedKinds: ['synthetic', 'sanitized'], requireVersion: true },
  e2e: {
    requiredSuites: ['smoke', 'regression'],
    pathSuites: [{ paths: ['apps/desktop/**'], suites: ['desktop-test-channel'] }],
    requireDatasetMatch: true,
    maxAgeHours: 24,
  },
  manualAcceptance: { mode: 'risk-based', riskLevels: ['high', 'critical'], maxAgeHours: 24 },
};

function readyEvidence(overrides = {}) {
  const observedAt = '2026-08-06T08:00:00Z';
  return {
    version: 1,
    observedAt,
    pullRequest: {
      number: 293,
      headSha: sha,
      baseBranch: 'main',
      baseRepository: 'dataelement/coAligne',
      headRepository: 'dataelement/coAligne',
      draft: false,
      mergeState: 'CLEAN',
      labels: ['loop:automerge'],
      approvals: 1,
      approvalSha: sha,
      changesRequested: false,
      unresolvedThreads: 0,
      attempts: 1,
      riskLevel: 'low',
      changedPaths: ['apps/web/src/fix.ts', 'apps/web/test/fix.test.ts'],
    },
    checks: [{ name: 'drone/pr', status: 'success', sha, completedAt: observedAt }],
    deployment: { environment: 'test', status: 'success', sha, completedAt: observedAt },
    testData: { kind: 'sanitized', version: 'dataset-7', status: 'success', sha, completedAt: observedAt },
    e2e: [
      { suite: 'smoke', status: 'success', sha, datasetVersion: 'dataset-7', completedAt: observedAt },
      { suite: 'regression', status: 'success', sha, datasetVersion: 'dataset-7', completedAt: observedAt },
    ],
    ...overrides,
  };
}

const pathPolicy = {
  version: 1,
  denylist: ['auth/**', '.github/**'],
  maxFiles: 10,
  autoMergeAllowlist: ['apps/web/src/**', 'apps/web/test/**'],
};

test('a PR with fresh exact-SHA evidence is merge-ready', () => {
  const decision = evaluatePromotion(contract, readyEvidence(), pathPolicy);
  assert.equal(decision.allowed, true);
  assert.equal(decision.stage, 'merge-ready');
  assert.deepEqual(decision.issues, []);
});

test('a new commit invalidates deployment, data, and E2E evidence', () => {
  const evidence = readyEvidence();
  evidence.pullRequest.headSha = 'new456';
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  assert.equal(decision.allowed, false);
  assert.equal(decision.stage, 'review');
  assert.ok(decision.issues.some((item) => item.code === 'check-missing'));
  assert.ok(decision.issues.some((item) => item.code === 'approval-sha'));
  assert.ok(decision.issues.some((item) => item.code === 'deployment-sha'));
  assert.ok(decision.issues.some((item) => item.code === 'test-data-sha'));
  assert.equal(decision.issues.filter((item) => item.code === 'e2e-missing').length, 2);
});

test('risk-based manual acceptance is required only for configured risk levels', () => {
  const low = evaluatePromotion(contract, readyEvidence(), pathPolicy);
  assert.equal(low.allowed, true);

  const highEvidence = readyEvidence();
  highEvidence.pullRequest.riskLevel = 'high';
  const high = evaluatePromotion(contract, highEvidence, pathPolicy);
  assert.equal(high.allowed, false);
  assert.ok(high.issues.some((item) => item.code === 'acceptance-missing'));

  highEvidence.manualAcceptance = {
    status: 'success',
    sha,
    completedAt: highEvidence.observedAt,
    actor: 'maintainer',
  };
  assert.equal(evaluatePromotion(contract, highEvidence, pathPolicy).allowed, true);
});

test('dataset provenance is enforced and production data is rejected', () => {
  const evidence = readyEvidence();
  evidence.testData.kind = 'production';
  evidence.e2e[0].datasetVersion = 'other-dataset';
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  assert.ok(decision.issues.some((item) => item.code === 'test-data-kind'));
  assert.ok(decision.issues.some((item) => item.code === 'e2e-dataset'));
});

test('changed paths activate additional risk-based E2E suites', () => {
  const evidence = readyEvidence();
  evidence.pullRequest.changedPaths = ['apps/desktop/src/main.ts'];
  const desktopPolicy = {
    ...pathPolicy,
    autoMergeAllowlist: ['apps/desktop/src/**'],
  };
  const missing = evaluatePromotion(contract, evidence, desktopPolicy);
  assert.ok(
    missing.issues.some((item) => item.code === 'e2e-missing' && item.message.includes('desktop-test-channel')),
  );

  evidence.e2e.push({
    suite: 'desktop-test-channel',
    status: 'success',
    sha,
    datasetVersion: 'dataset-7',
    completedAt: evidence.observedAt,
  });
  assert.equal(evaluatePromotion(contract, evidence, desktopPolicy).allowed, true);
});

test('stale test-environment evidence cannot authorize a merge', () => {
  const evidence = readyEvidence();
  evidence.observedAt = '2026-08-08T09:00:00Z';
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  assert.ok(decision.issues.some((item) => item.code === 'deployment-stale'));
  assert.equal(decision.issues.filter((item) => item.code === 'e2e-stale').length, 2);
});

test('static path policy remains part of the promotion decision', () => {
  const evidence = readyEvidence();
  evidence.pullRequest.changedPaths = ['auth/session.ts'];
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  assert.equal(decision.allowed, false);
  assert.equal(decision.stage, 'policy');
  assert.ok(decision.issues.some((item) => item.code === 'path-denylist'));
});

test('forks, attempt exhaustion, missing approvals, and unresolved threads require humans', () => {
  const evidence = readyEvidence();
  evidence.pullRequest.headRepository = 'contributor/coAligne';
  evidence.pullRequest.attempts = 3;
  evidence.pullRequest.approvals = 0;
  evidence.pullRequest.unresolvedThreads = 2;
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  for (const code of ['fork', 'attempt-limit', 'approvals', 'review-threads']) {
    assert.ok(decision.issues.some((item) => item.code === code), `missing ${code}`);
  }
});

test('missing paths and duplicate receipts fail closed', () => {
  const evidence = readyEvidence();
  evidence.pullRequest.changedPaths = [];
  evidence.checks.push({ ...evidence.checks[0] });
  evidence.e2e.push({ ...evidence.e2e[0] });
  const decision = evaluatePromotion(contract, evidence, pathPolicy);
  for (const code of ['changed-paths-missing', 'check-ambiguous', 'e2e-ambiguous']) {
    assert.ok(decision.issues.some((item) => item.code === code), `missing ${code}`);
  }
});

test('contract and evidence parsers reject malformed input', () => {
  assert.throws(() => parsePromotionContract({ version: 2 }), /version must be 1/);
  assert.throws(() => parsePromotionEvidence({ version: 1 }), /observedAt|pullRequest/);
});

test('loaders read YAML contract and JSON evidence', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'loop-promotion-'));
  const contractFile = path.join(dir, 'promotion.yaml');
  const evidenceFile = path.join(dir, 'evidence.json');
  await writeFile(contractFile, `
version: 1
authorization:
  labels: ["loop:automerge"]
  minApprovals: 1
pullRequest:
  baseBranches: [main]
  requireCleanMerge: true
  requireResolvedThreads: true
  sameRepositoryOnly: true
  maxAttempts: 3
checks:
  required: ["drone/pr"]
deployment:
  required: true
  environment: test
testData:
  required: true
  allowedKinds: [synthetic, sanitized]
  requireVersion: true
e2e:
  requiredSuites: [smoke, regression]
  requireDatasetMatch: true
manualAcceptance:
  mode: risk-based
  riskLevels: [high]
`);
  await writeFile(evidenceFile, JSON.stringify(readyEvidence()));
  const loadedContract = await loadPromotionContract(contractFile);
  const loadedEvidence = await loadPromotionEvidence(evidenceFile);
  assert.equal(loadedContract.deployment.environment, 'test');
  assert.equal(loadedEvidence.pullRequest.number, 293);
});
