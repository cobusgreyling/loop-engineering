import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cadenceToRunsPerDay,
  runsPerDayForInterval,
  estimateCost,
} from '../dist/estimator.js';

const CI_SWEEPER = {
  id: 'ci-sweeper',
  name: 'CI Sweeper',
  cadence: '5m-15m',
  token_cost: 'very-high',
  cost: {
    tokens_noop: 5000,
    tokens_report: 50000,
    tokens_action: 200000,
    suggested_daily_cap: 1000000,
    early_exit_required: true,
  },
};

test('runsPerDayForInterval: 15m = 96', () => {
  assert.equal(runsPerDayForInterval('15m'), 96);
});

test('runsPerDayForInterval: 1d = 1', () => {
  assert.equal(runsPerDayForInterval('1d'), 1);
});

test('cadenceToRunsPerDay: range uses fastest by default', () => {
  assert.equal(cadenceToRunsPerDay('5m-15m'), 288);
});

test('cadenceToRunsPerDay: conservative uses slowest', () => {
  assert.equal(cadenceToRunsPerDay('5m-15m', true), 96);
});

test('estimateCost: ci-sweeper 15m L2 warns on high spend', () => {
  const r = estimateCost({
    pattern: CI_SWEEPER,
    cadence: '15m',
    level: 'L2',
  });
  assert.equal(r.runsPerDay, 96);
  assert.ok(r.scenarios.action.tokensPerDay > r.suggestedDailyCap);
  assert.ok(r.warnings.length > 0);
  assert.ok(r.scenarios.realistic.tokensPerDay < r.scenarios.action.tokensPerDay);
});

test('estimateCost: rejects an invalid readiness level', () => {
  assert.throws(
    () => estimateCost({ pattern: CI_SWEEPER, level: 'L9' }),
    /Invalid readiness level/,
  );
});

test('estimateCost: daily-triage 1d L1 is cheap', () => {
  const r = estimateCost({
    pattern: {
      id: 'daily-triage',
      name: 'Daily Triage',
      cadence: '1d',
      token_cost: 'low',
      cost: {
        tokens_noop: 5000,
        tokens_report: 50000,
        tokens_action: 200000,
        suggested_daily_cap: 100000,
        early_exit_required: false,
      },
    },
    level: 'L1',
  });
  assert.equal(r.runsPerDay, 1);
  assert.ok(r.scenarios.realistic.tokensPerDay <= 100000);
});