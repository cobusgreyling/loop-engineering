import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateRepair,
  parseRepairContract,
  parseRepairEvidence,
} from '../dist/repair.js';

const contract = {
  version: 1,
  labels: {
    pause: 'loop-pause-all',
    lock: 'loop:repairing',
    bug: 'bug',
    attemptsPrefix: 'loop:attempts:',
    priority: ['priority:critical', 'priority:high', 'priority:medium'],
    sensitive: ['security', 'area:auth', 'area:billing'],
  },
  maxAttempts: 3,
  sensitivePaths: ['deploy/**', 'server/alembic/**', '.github/**'],
};

function issue(number, overrides = {}) {
  return {
    type: 'issue',
    number,
    title: `Bug ${number}`,
    updatedAt: '2026-08-01T00:00:00Z',
    labels: ['bug'],
    reproduction: 'unknown',
    ...overrides,
  };
}

function pull(number, overrides = {}) {
  return {
    type: 'pull-request',
    number,
    title: `PR ${number}`,
    updatedAt: '2026-08-02T00:00:00Z',
    labels: [],
    changedPaths: ['server/app/main.py'],
    headSha: 'a'.repeat(40),
    branchOwned: true,
    reviewActionable: false,
    check: { status: 'success', failureClass: 'unknown' },
    ...overrides,
  };
}

function evidence(targets, overrides = {}) {
  return {
    version: 1,
    observedAt: '2026-08-06T00:00:00Z',
    repository: 'dataelement/coAligne',
    pauseIssues: [],
    targets,
    ...overrides,
  };
}

test('confirmed bugs outrank review feedback and deterministic check failures', () => {
  const decision = evaluateRepair(contract, evidence([
    pull(3, { check: { status: 'failure', failureClass: 'deterministic' } }),
    pull(2, { reviewActionable: true }),
    issue(1, { reproduction: 'confirmed' }),
  ]));
  assert.equal(decision.state, 'selected');
  assert.equal(decision.selected.number, 1);
  assert.equal(decision.selected.action, 'repair-issue');
});

test('review feedback outranks deterministic checks and unconfirmed bug diagnosis', () => {
  const decision = evaluateRepair(contract, evidence([
    issue(1),
    pull(2, { reviewActionable: true }),
    pull(3, { check: { status: 'failure', failureClass: 'deterministic' } }),
  ]));
  assert.equal(decision.selected.number, 2);
  assert.equal(decision.selected.action, 'address-review');
});

test('pause and ownership locks stop selection before ranking', () => {
  assert.equal(evaluateRepair(contract, evidence([issue(1)], { pauseIssues: [99] })).state, 'paused');
  assert.equal(evaluateRepair(contract, evidence([issue(1, { labels: ['bug', 'loop:repairing'] })])).state, 'locked');
});

test('attempt exhaustion, conflicts, and sensitive work require humans', () => {
  const decision = evaluateRepair(contract, evidence([
    issue(1, { labels: ['bug', 'loop:attempts:3'] }),
    issue(2, { labels: ['bug', 'loop:attempts:1', 'loop:attempts:2'] }),
    pull(3, { reviewActionable: true, changedPaths: ['deploy/docker-compose.yml'] }),
    issue(4, { labels: ['bug', 'loop:attempts:many'] }),
  ]));
  assert.equal(decision.state, 'human-required');
  assert.deepEqual(decision.issues.map((item) => item.code), [
    'attempt-limit',
    'attempt-label-conflict',
    'sensitive-target',
    'attempt-label-conflict',
  ]);
});

test('linked issues wait and infrastructure failures are not treated as code fixes', () => {
  const decision = evaluateRepair(contract, evidence([
    issue(1, { linkedPullRequest: 12 }),
    pull(2, { check: { status: 'failure', failureClass: 'infrastructure' } }),
  ]));
  assert.equal(decision.state, 'human-required');
  assert.deepEqual(decision.issues.map((item) => item.code), ['linked-pr', 'non-code-failure']);
});

test('non-owned PR branches produce proposals instead of unauthorized pushes', () => {
  const decision = evaluateRepair(contract, evidence([
    pull(2, { reviewActionable: true, branchOwned: false }),
  ]));
  assert.equal(decision.selected.mode, 'propose');
});

test('non-actionable PRs do not create sensitive-path alert noise', () => {
  const decision = evaluateRepair(contract, evidence([
    pull(2, { changedPaths: ['deploy/docker-compose.yml'] }),
  ]));
  assert.equal(decision.state, 'idle');
  assert.deepEqual(decision.issues, []);
});

test('contract and evidence parsers reject malformed inputs', () => {
  assert.throws(() => parseRepairContract({ ...contract, maxAttempts: 0 }), /greater than zero/);
  assert.throws(() => parseRepairEvidence({ ...evidence([]), pauseIssues: [0] }), /positive issue numbers/);
  assert.throws(
    () => parseRepairEvidence(evidence([pull(2, { headSha: undefined })])),
    /headSha must be a full lowercase SHA/,
  );
  assert.throws(() => parseRepairEvidence(evidence([issue(1), issue(1)])), /contains duplicates/);
});
