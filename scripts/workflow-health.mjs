#!/usr/bin/env node
// Workflow health for the daily triage: which dogfood workflows are failing.
//
// Scope is always `main`. Runs on `automated/*` PR branches are created with
// GITHUB_TOKEN and end as startup failures ("workflow file issue", no jobs),
// so they carry no signal about the gate itself. The gates that matter already
// run inside the automation before the PR opens.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const WORKFLOWS = ['validate-patterns', 'audit'];

const FAILURE = new Set(['failure', 'timed_out', 'startup_failure']);
const PENDING = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);

export function argsFor(workflow, branch = 'main') {
  return [
    'run', 'list',
    '--workflow', `${workflow}.yml`,
    '--branch', branch,
    '--limit', '1',
    '--json', 'conclusion',
  ];
}

export function evaluate(rows, workflows = WORKFLOWS) {
  const failing = [];
  const pending = [];
  const unknown = [];
  for (const workflow of workflows) {
    const row = rows.find((r) => r.workflow === workflow);
    const conclusion = row?.conclusion || 'unknown';
    if (FAILURE.has(conclusion)) failing.push(workflow);
    else if (PENDING.has(conclusion)) pending.push(workflow);
    else if (conclusion === 'unknown') unknown.push(workflow);
  }
  return { failing: failing.length, failingWorkflows: failing, pending, unknown };
}

export function collect({ exec = execFileSync, branch = 'main', workflows = WORKFLOWS } = {}) {
  const rows = [];
  for (const workflow of workflows) {
    let conclusion = 'unknown';
    try {
      const out = exec('gh', argsFor(workflow, branch), { encoding: 'utf8' }).trim();
      const parsed = JSON.parse(out || '[]');
      conclusion = parsed[0]?.conclusion || 'unknown';
    } catch {
      conclusion = 'unknown';
    }
    rows.push({ workflow, conclusion });
  }
  return { ...evaluate(rows, workflows), rows };
}

export function render(result) {
  const lines = result.rows.map((r) => `${r.workflow}: ${r.conclusion}`);
  lines.push(`failing=${result.failing}`);
  return lines.join('\n');
}

export function main({ env = process.env, ...opts } = {}) {
  const result = collect(opts);
  const text = render(result);
  console.log(text);
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `failing=${result.failing}\n`);
  }
  return result;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
