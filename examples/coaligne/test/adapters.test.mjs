import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  collectExecutionEvidence,
  collectManualAcceptance,
  isTrustedCiCheck,
  matchesUrlPrefix,
  normalizeStatus,
  selectPulls,
} from '../collect-promotion-evidence.mjs';
import { selectBuild } from '../trigger-drone-promotion.mjs';
import {
  evaluatePromotion,
  loadPromotionContract,
  parsePromotionEvidence,
} from '../../../tools/loop-gate/dist/promotion.js';

test('collector normalizes both commit statuses and check runs', () => {
  assert.equal(normalizeStatus('success'), 'success');
  assert.equal(normalizeStatus('failure'), 'failure');
  assert.equal(normalizeStatus('completed', 'success'), 'success');
  assert.equal(normalizeStatus('in_progress'), 'pending');
});

test('collector maps exact dataset and suite statuses to receipts', () => {
  const sha = 'abc123';
  const completedAt = '2026-08-06T10:00:00Z';
  const checks = [
    {
      name: 'loop/test-data/coaligne-acceptance-v1',
      status: 'success',
      sha,
      completedAt,
      issuer: 'loop-runner',
    },
    {
      name: 'loop/e2e/collaboration',
      status: 'success',
      sha,
      completedAt,
      url: 'https://ci.example/build/1',
      issuer: 'loop-runner',
    },
  ];
  const evidence = collectExecutionEvidence(
    checks,
    sha,
    'coaligne-acceptance-v1',
    'loop-runner',
  );
  assert.equal(evidence.testData.version, 'coaligne-acceptance-v1');
  assert.equal(evidence.e2e[0].suite, 'collaboration');
  assert.equal(evidence.e2e[0].datasetVersion, evidence.testData.version);
});

test('collector does not accept a status for an obsolete dataset version', () => {
  const evidence = collectExecutionEvidence(
    [
      {
        name: 'loop/test-data/coaligne-acceptance-v0',
        status: 'success',
        sha: 'abc123',
        completedAt: '2026-08-06T10:00:00Z',
        issuer: 'loop-runner',
      },
    ],
    'abc123',
    'coaligne-acceptance-v1',
    'loop-runner',
  );
  assert.equal(evidence.testData, undefined);
});

test('collector ignores machine receipts from untrusted issuers', () => {
  const checks = [
    {
      name: 'loop/test-data/coaligne-acceptance-v1',
      status: 'success',
      sha: 'abc123',
      completedAt: '2026-08-06T10:00:00Z',
      issuer: 'pr-author',
    },
  ];
  const evidence = collectExecutionEvidence(
    checks,
    'abc123',
    'coaligne-acceptance-v1',
    'loop-runner',
  );
  assert.equal(evidence.testData, undefined);
});

test('legacy Drone statuses can be anchored to an exact trusted URL prefix', () => {
  const check = {
    name: 'continuous-integration/drone/pr',
    issuer: undefined,
    url: 'http://drone.example.test/dataelement/coAligne/422',
  };
  assert.equal(matchesUrlPrefix(check.url, 'http://drone.example.test'), true);
  assert.equal(isTrustedCiCheck(check, undefined, 'http://drone.example.test'), true);
  assert.equal(
    isTrustedCiCheck(
      { ...check, url: 'http://drone.example.test.attacker.invalid/build/1' },
      undefined,
      'http://drone.example.test',
    ),
    false,
  );
});

test('an explicit webhook PR bypasses the scheduled automerge-label filter', () => {
  const pulls = [{ number: 299, labels: [] }];
  assert.deepEqual(selectPulls(pulls, { pr: 299, allOpen: false }), pulls);
  assert.deepEqual(selectPulls(pulls, { allOpen: false }), []);
});

test('manual acceptance requires the exact SHA and an allowed comment author', () => {
  const comments = [
    {
      body: '/loop accept old-sha',
      user: { login: 'maintainer-one' },
      updated_at: '2026-08-06T09:00:00Z',
    },
    {
      body: '/loop accept abc123',
      user: { login: 'pr-author' },
      updated_at: '2026-08-06T09:30:00Z',
    },
    {
      body: '/loop accept abc123',
      user: { login: 'maintainer-one' },
      updated_at: '2026-08-06T10:00:00Z',
    },
  ];
  const accepted = collectManualAcceptance(comments, 'abc123', ['maintainer-one']);
  assert.equal(accepted.actor, 'maintainer-one');
  assert.equal(accepted.sha, 'abc123');
  assert.equal(collectManualAcceptance(comments, 'new-sha', ['maintainer-one']), undefined);
});

test('Drone selector suppresses duplicate promotion builds for a SHA', () => {
  const selected = selectBuild(
    [
      { number: 10, event: 'pull_request', status: 'success', after: 'abc123' },
      {
        number: 11,
        event: 'promote',
        status: 'failure',
        after: 'main-sha',
        params: { LOOP_REVISION: 'abc123' },
      },
    ],
    'abc123',
    42,
  );
  assert.equal(selected.kind, 'existing');
  assert.equal(selected.build.number, 11);
});

test('Drone selector uses trusted main config after verifying the newest PR build', () => {
  const selected = selectBuild(
    [
      { number: 8, event: 'pull_request', status: 'success', after: 'abc123', pull_request: 42 },
      { number: 10, event: 'pull_request', status: 'success', after: 'abc123', pull_request: 42 },
      { number: 12, event: 'pull_request', status: 'failure', after: 'abc123', pull_request: 42 },
      { number: 20, event: 'push', status: 'success', after: 'main-sha', source: 'main' },
    ],
    'abc123',
    42,
  );
  assert.equal(selected.kind, 'source');
  assert.equal(selected.build.number, 20);
  assert.equal(selected.candidateBuild.number, 10);
});

test('published coAligne receipts satisfy the real promotion contract', async () => {
  const sha = 'abc123';
  const completedAt = '2026-08-06T10:00:00Z';
  const suiteNames = [
    'smoke',
    'regression-focus',
    'browser-web',
    'access',
    'project-lifecycle',
    'collaboration',
    'file-handling',
    'local-sync',
  ];
  const checks = [
    {
      name: 'continuous-integration/drone/pr',
      status: 'success',
      sha,
      completedAt,
      issuer: 'drone-ci',
    },
    {
      name: 'loop/test-data/coaligne-acceptance-v1',
      status: 'success',
      sha,
      completedAt,
      issuer: 'loop-runner',
    },
    ...suiteNames.map((suite) => ({
      name: `loop/e2e/${suite}`,
      status: 'success',
      sha,
      completedAt,
      issuer: 'loop-runner',
    })),
  ];
  const execution = collectExecutionEvidence(
    checks,
    sha,
    'coaligne-acceptance-v1',
    'loop-runner',
  );
  const evidence = parsePromotionEvidence({
    version: 1,
    observedAt: '2026-08-06T10:01:00Z',
    pullRequest: {
      number: 42,
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
      attempts: 0,
      riskLevel: 'low',
      changedPaths: ['apps/web/src/App.tsx'],
    },
    checks,
    deployment: {
      environment: 'coaligne-test',
      status: 'success',
      sha,
      completedAt,
    },
    testData: execution.testData,
    e2e: execution.e2e,
  });
  const contract = await loadPromotionContract(
    fileURLToPath(new URL('../promotion.yaml', import.meta.url)),
  );
  const decision = evaluatePromotion(contract, evidence);
  assert.equal(decision.allowed, true, JSON.stringify(decision.issues));
  assert.equal(decision.stage, 'merge-ready');
});
