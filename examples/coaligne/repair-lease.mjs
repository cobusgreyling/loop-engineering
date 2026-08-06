#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LOCK_LABEL = 'loop:repairing';
const WATCH_LABEL = 'loop:watch';
const ATTEMPT_PREFIX = 'loop:attempts:';
const RISKS = ['low', 'medium', 'high', 'critical'];

function usage() {
  console.log(`repair-lease — claim or release a planner-selected coAligne target

Usage:
  node repair-lease.mjs --repository owner/repo --decision decision.json --risk <level> [--execute]
  node repair-lease.mjs --repository owner/repo --decision decision.json --release [--execute]

Dry-run is the default. --execute mutates GitHub labels.
`);
}

function parseArgs(argv) {
  const result = { execute: false, release: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--repository') result.repository = argv[++index];
    else if (value === '--decision') result.decisionFile = argv[++index];
    else if (value === '--risk') result.risk = argv[++index];
    else if (value === '--execute') result.execute = true;
    else if (value === '--release') result.release = true;
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!result.help && (!result.repository || !result.decisionFile)) {
    throw new Error('--repository and --decision are required.');
  }
  if (!result.help && !result.release && !RISKS.includes(result.risk)) {
    throw new Error(`--risk must be one of: ${RISKS.join(', ')}.`);
  }
  return result;
}

function ghJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed.`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
}

function labelsOf(item) {
  return (item.labels ?? []).map((label) => typeof label === 'string' ? label : label.name);
}

function parseAttempt(labels) {
  const attemptLabels = labels.filter((label) => label.startsWith(ATTEMPT_PREFIX));
  if (attemptLabels.length === 0) return 0;
  if (attemptLabels.length !== 1) throw new Error('Target has conflicting attempt labels.');
  const value = Number(attemptLabels[0].slice(ATTEMPT_PREFIX.length));
  if (!Number.isInteger(value) || value < 0) throw new Error('Target has an invalid attempt label.');
  return value;
}

function claimLabels(labels, risk, expectedAttempt) {
  if (labels.includes(LOCK_LABEL)) throw new Error('Target is already locked.');
  const currentAttempt = parseAttempt(labels);
  if (currentAttempt !== expectedAttempt) {
    throw new Error(`Attempt changed: planner saw ${expectedAttempt}, GitHub has ${currentAttempt}.`);
  }
  if (currentAttempt >= 3) throw new Error('Attempt circuit breaker reached.');
  return [
    ...labels.filter((label) => !label.startsWith(ATTEMPT_PREFIX) && !label.startsWith('risk:')),
    LOCK_LABEL,
    WATCH_LABEL,
    `${ATTEMPT_PREFIX}${currentAttempt + 1}`,
    `risk:${risk}`,
  ].filter((label, index, all) => all.indexOf(label) === index);
}

function releaseLabels(labels) {
  return labels.filter((label) => label !== LOCK_LABEL);
}

function selectedFromDecision(decision, repository) {
  if (decision.state !== 'selected' || !decision.selected) throw new Error('Decision does not select a target.');
  if (decision.repository !== repository) throw new Error('Decision repository does not match --repository.');
  const selected = decision.selected;
  if (!['issue', 'pull-request'].includes(selected.type)) throw new Error('Selected target type is invalid.');
  if (!Number.isInteger(selected.number) || selected.number <= 0) throw new Error('Selected target number is invalid.');
  if (!Number.isInteger(selected.attempts) || selected.attempts < 0 || selected.attempts >= 3) {
    throw new Error('Selected target attempt is invalid or exhausted.');
  }
  if (selected.type === 'pull-request' && !/^[0-9a-f]{40}$/.test(selected.headSha ?? '')) {
    throw new Error('Selected pull request requires a full lowercase HEAD SHA.');
  }
  return selected;
}

function openLocks(repository) {
  const pages = ghJson(['api', `repos/${repository}/issues?state=open&per_page=100`, '--paginate', '--slurp']);
  return pages.flat().filter((item) => labelsOf(item).includes(LOCK_LABEL)).map((item) => item.number);
}

function patchLabels(repository, number, labels) {
  const result = spawnSync(
    'gh',
    ['api', `repos/${repository}/issues/${number}`, '--method', 'PATCH', '--input', '-'],
    { encoding: 'utf8', input: JSON.stringify({ labels }) },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'GitHub label update failed.');
}

function validateHead(repository, selected) {
  if (selected.type !== 'pull-request') return;
  const pull = ghJson(['api', `repos/${repository}/pulls/${selected.number}`]);
  if (pull.head.sha !== selected.headSha) {
    throw new Error(`PR HEAD changed: ${pull.head.sha} != ${selected.headSha}.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const decision = JSON.parse(await readFile(args.decisionFile, 'utf8'));
  const selected = selectedFromDecision(decision, args.repository);
  const target = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
  const currentLabels = labelsOf(target);

  if (args.release) {
    const desired = releaseLabels(currentLabels);
    if (args.execute && desired.length !== currentLabels.length) patchLabels(args.repository, selected.number, desired);
    console.log(JSON.stringify({ action: 'release', executed: args.execute, target: selected.number, labels: desired }));
    return;
  }

  validateHead(args.repository, selected);
  const locks = openLocks(args.repository);
  if (locks.length > 0) throw new Error(`Global repair lock already held by #${locks.join(', #')}.`);
  const refreshed = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
  const desired = claimLabels(labelsOf(refreshed), args.risk, selected.attempts);
  if (!args.execute) {
    console.log(JSON.stringify({ action: 'claim', executed: false, target: selected.number, labels: desired }));
    return;
  }
  patchLabels(args.repository, selected.number, desired);
  const verifiedLocks = openLocks(args.repository);
  if (verifiedLocks.length !== 1 || verifiedLocks[0] !== selected.number) {
    const refreshed = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
    patchLabels(args.repository, selected.number, releaseLabels(labelsOf(refreshed)));
    throw new Error(`Could not acquire sole repair lock; observed #${verifiedLocks.join(', #')}.`);
  }
  console.log(JSON.stringify({ action: 'claim', executed: true, target: selected.number, labels: desired }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { claimLabels, parseAttempt, releaseLabels, selectedFromDecision };
