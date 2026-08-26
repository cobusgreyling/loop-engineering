#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { classifyPr, classifyIssue, buildSections, renderState } from './github-triage.mjs';

const exec = promisify(execFile);
const SCRIPT = new URL('./github-triage.mjs', import.meta.url).pathname;
const NOW = Date.parse('2026-08-26T12:00:00Z');

test('classifyPr: empty checks is high (fork CI not approved)', () => {
  const r = classifyPr(
    {
      number: 543,
      title: 'Improve loop constraints startup message',
      url: 'https://github.com/cobusgreyling/loop-engineering/pull/543',
      isDraft: false,
      mergeStateStatus: 'BLOCKED',
      statusCheckRollup: [],
    },
    NOW,
  );
  assert.equal(r.bucket, 'high');
  assert.match(r.line, /no CI/);
  assert.match(r.line, /#543/);
});

test('classifyPr: conflicts beat green CI', () => {
  const r = classifyPr(
    {
      number: 41,
      title: 'bump changesets',
      mergeable: 'CONFLICTING',
      mergeStateStatus: 'DIRTY',
      statusCheckRollup: [{ conclusion: 'SUCCESS', status: 'COMPLETED', name: 'validate' }],
    },
    NOW,
  );
  assert.equal(r.bucket, 'high');
  assert.match(r.line, /conflicts/);
});

test('classifyPr: failing check is high', () => {
  const r = classifyPr(
    {
      number: 12,
      title: 'ruff bump',
      mergeStateStatus: 'UNSTABLE',
      statusCheckRollup: [{ conclusion: 'FAILURE', status: 'COMPLETED', name: 'test' }],
    },
    NOW,
  );
  assert.equal(r.bucket, 'high');
  assert.match(r.line, /CI red/);
});

test('classifyPr: clean ready PR is watch, not high', () => {
  const r = classifyPr(
    {
      number: 537,
      title: 'successRatePct',
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: [{ conclusion: 'SUCCESS', status: 'COMPLETED', name: 'validate' }],
    },
    NOW,
  );
  assert.equal(r.bucket, 'watch');
  assert.match(r.line, /waiting on review/);
});

test('classifyPr: draft is noise unless idle 30d', () => {
  const fresh = classifyPr(
    { number: 1, title: 'wip', isDraft: true, updatedAt: '2026-08-20T00:00:00Z' },
    NOW,
  );
  assert.equal(fresh.bucket, 'noise');
  const stale = classifyPr(
    { number: 1, title: 'wip', isDraft: true, updatedAt: '2026-06-01T00:00:00Z' },
    NOW,
  );
  assert.equal(stale.bucket, 'watch');
});

test('classifyIssue: unanswered human issue >7d is high', () => {
  const r = classifyIssue(
    {
      number: 522,
      title: 'refactor todos',
      url: 'https://github.com/cobusgreyling/loop-engineering/issues/522',
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
      comments: 0,
      author: { login: 'hufeide' },
      labels: [{ name: 'pattern-request' }],
    },
    NOW,
  );
  assert.equal(r.bucket, 'high');
  assert.match(r.line, /unanswered/);
});

test('classifyIssue: stale good-first-issue is watch', () => {
  const r = classifyIssue(
    {
      number: 118,
      title: 'Share a story',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-20T00:00:00Z',
      comments: 2,
      labels: [{ name: 'good first issue' }],
      author: { login: 'cobusgreyling' },
    },
    NOW,
  );
  assert.equal(r.bucket, 'watch');
  assert.match(r.line, /good first issue/);
});

test('classifyIssue: bot loop-report is noise unless very idle', () => {
  const r = classifyIssue(
    {
      number: 403,
      title: 'Loop report',
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
      comments: 0,
      labels: [{ name: 'loop-report' }],
      author: { login: 'github-actions[bot]', is_bot: true },
    },
    NOW,
  );
  assert.equal(r.bucket, 'noise');
});

test('renderState: score 100 is watch, not high, when GitHub is quiet', () => {
  const md = renderState({
    high: [],
    watch: [],
    noise: [],
    score: '100',
    level: 'L3',
    date: '2026-08-26T12:00:00Z',
  });
  assert.match(md, /No blocked PRs/);
  assert.match(md, /informational, not a reason to act/);
  const highBlock = md.split('## Watch List')[0];
  assert.doesNotMatch(highBlock, /Loop Ready \*\*100\*\*/);
  assert.match(md.split('## Watch List')[1], /Loop Ready \*\*100\*\*/);
});

test('renderState: failing dogfood workflows are high even at score 100', () => {
  const md = renderState({
    high: [],
    watch: [],
    noise: [],
    score: '100',
    level: 'L3',
    date: '2026-08-26T12:00:00Z',
    failingWorkflows: 2,
  });
  assert.match(md, /\*\*2\*\* dogfood workflow/);
});

test('renderState: score below 58 is high', () => {
  const md = renderState({
    high: [],
    watch: [],
    noise: [],
    score: '40',
    level: 'L1',
    date: '2026-08-26T12:00:00Z',
  });
  assert.match(md, /below the 58 floor/);
});

test('CLI writes STATE.md from fixtures without calling gh', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'github-triage-'));
  try {
    const prs = path.join(dir, 'prs.json');
    const issues = path.join(dir, 'issues.json');
    const outMd = path.join(dir, 'STATE.md');
    const outJson = path.join(dir, 'summary.json');
    await writeFile(
      prs,
      JSON.stringify([
        {
          number: 543,
          title: 'constraints',
          url: 'https://example.test/543',
          isDraft: false,
          mergeStateStatus: 'BLOCKED',
          statusCheckRollup: [],
        },
      ]),
    );
    await writeFile(issues, JSON.stringify([]));
    const { stderr } = await exec('node', [
      SCRIPT,
      '--score',
      '100',
      '--level',
      'L3',
      '--prs-json',
      prs,
      '--issues-json',
      issues,
      '--out-md',
      outMd,
      '--out-json',
      outJson,
    ]);
    assert.match(stderr, /high=1/);
    const md = await readFile(outMd, 'utf8');
    assert.match(md, /no CI/);
    assert.match(md, /#543/);
    const summary = JSON.parse(await readFile(outJson, 'utf8'));
    assert.equal(summary.high, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('buildSections counts mixed buckets', () => {
  const { high, watch } = buildSections(
    {
      prs: [
        { number: 1, title: 'a', mergeStateStatus: 'CLEAN', statusCheckRollup: [{ conclusion: 'SUCCESS', status: 'COMPLETED' }] },
        { number: 2, title: 'b', mergeStateStatus: 'BLOCKED', statusCheckRollup: [] },
      ],
      issues: [],
    },
    NOW,
  );
  assert.equal(high.length, 1);
  assert.equal(watch.length, 1);
});
