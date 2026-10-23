#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { argsFor, collect, evaluate, render } from './workflow-health.mjs';

test('argsFor: scopes the query to main (regression pin)', () => {
  const args = argsFor('audit');
  assert.deepEqual(args, [
    'run', 'list',
    '--workflow', 'audit.yml',
    '--branch', 'main',
    '--limit', '1',
    '--json', 'conclusion',
  ]);
});

test('argsFor: branch can be overridden explicitly', () => {
  const args = argsFor('audit', 'release');
  assert.equal(args[args.indexOf('--branch') + 1], 'release');
});

test('evaluate: all success is zero failing', () => {
  const r = evaluate([
    { workflow: 'validate-patterns', conclusion: 'success' },
    { workflow: 'audit', conclusion: 'success' },
  ]);
  assert.equal(r.failing, 0);
  assert.deepEqual(r.failingWorkflows, []);
});

test('evaluate: a main failure counts, with the workflow name', () => {
  const r = evaluate([
    { workflow: 'validate-patterns', conclusion: 'success' },
    { workflow: 'audit', conclusion: 'failure' },
  ]);
  assert.equal(r.failing, 1);
  assert.deepEqual(r.failingWorkflows, ['audit']);
});

test('evaluate: startup_failure and timed_out count as failures', () => {
  const r = evaluate([
    { workflow: 'validate-patterns', conclusion: 'startup_failure' },
    { workflow: 'audit', conclusion: 'timed_out' },
  ]);
  assert.equal(r.failing, 2);
});

test('evaluate: pending and unknown are not failures', () => {
  const r = evaluate([
    { workflow: 'validate-patterns', conclusion: 'in_progress' },
    { workflow: 'audit', conclusion: 'unknown' },
  ]);
  assert.equal(r.failing, 0);
  assert.deepEqual(r.pending, ['validate-patterns']);
  assert.deepEqual(r.unknown, ['audit']);
});

test('evaluate: a missing row is unknown, not success', () => {
  const r = evaluate([{ workflow: 'audit', conclusion: 'success' }]);
  assert.deepEqual(r.unknown, ['validate-patterns']);
  assert.equal(r.failing, 0);
});

test('collect: passes main-scoped argv to gh and maps conclusions', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    return JSON.stringify([{ conclusion: 'success' }]);
  };
  const r = collect({ exec });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('--branch'));
  assert.equal(calls[0][calls[0].indexOf('--branch') + 1], 'main');
  assert.equal(r.failing, 0);
  assert.equal(r.rows.length, 2);
});

test('collect: gh errors become unknown, never failures', () => {
  const exec = () => {
    throw new Error('boom');
  };
  const r = collect({ exec });
  assert.equal(r.failing, 0);
  assert.equal(r.unknown.length, 2);
});

test('render: prints one line per workflow plus failing=N', () => {
  const text = render({
    rows: [
      { workflow: 'validate-patterns', conclusion: 'success' },
      { workflow: 'audit', conclusion: 'failure' },
    ],
    failing: 1,
  });
  assert.equal(text, 'validate-patterns: success\naudit: failure\nfailing=1');
});
