#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RISKS = ['low', 'medium', 'high', 'critical'];

function usage() {
  console.log(`repair-lease — claim or release a planner-selected GitHub target

Usage:
  node scripts/repair-lease.mjs --repository owner/repo --decision decision.json --risk <level> [options]
  node scripts/repair-lease.mjs --repository owner/repo --decision decision.json --release [options]

Options:
  --execute                   Mutate GitHub; otherwise print the planned labels
  --lock-label <label>        Lease label (default: loop:repairing)
  --watch-label <label>       Managed-target label (default: loop:watch)
  --attempt-prefix <prefix>   Attempt label prefix (default: loop:attempts:)
  --risk-prefix <prefix>      Risk label prefix (default: risk:)
  --max-attempts <number>     Circuit breaker (default: 3)

Dry-run is the default. The flags must match repair.yaml when policy labels are customized.
`);
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseArgs(argv) {
  const result = {
    execute: false,
    release: false,
    lockLabel: 'loop:repairing',
    watchLabel: 'loop:watch',
    attemptPrefix: 'loop:attempts:',
    riskPrefix: 'risk:',
    maxAttempts: 3,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--repository') result.repository = requiredValue(argv, index++, value);
    else if (value === '--decision') result.decisionFile = requiredValue(argv, index++, value);
    else if (value === '--risk') result.risk = requiredValue(argv, index++, value);
    else if (value === '--lock-label') result.lockLabel = requiredValue(argv, index++, value);
    else if (value === '--watch-label') result.watchLabel = requiredValue(argv, index++, value);
    else if (value === '--attempt-prefix') result.attemptPrefix = requiredValue(argv, index++, value);
    else if (value === '--risk-prefix') result.riskPrefix = requiredValue(argv, index++, value);
    else if (value === '--max-attempts') result.maxAttempts = Number(requiredValue(argv, index++, value));
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
  if (!Number.isInteger(result.maxAttempts) || result.maxAttempts < 1) {
    throw new Error('--max-attempts must be a positive integer.');
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

function parseAttempt(labels, attemptPrefix = 'loop:attempts:') {
  const attemptLabels = labels.filter((label) => label.startsWith(attemptPrefix));
  if (attemptLabels.length === 0) return 0;
  if (attemptLabels.length !== 1) throw new Error('Target has conflicting attempt labels.');
  const value = Number(attemptLabels[0].slice(attemptPrefix.length));
  if (!Number.isInteger(value) || value < 0) throw new Error('Target has an invalid attempt label.');
  return value;
}

function claimLabels(labels, risk, expectedAttempt, policy = {}) {
  const {
    lockLabel = 'loop:repairing',
    watchLabel = 'loop:watch',
    attemptPrefix = 'loop:attempts:',
    riskPrefix = 'risk:',
    maxAttempts = 3,
  } = policy;
  if (labels.includes(lockLabel)) throw new Error('Target is already locked.');
  const currentAttempt = parseAttempt(labels, attemptPrefix);
  if (currentAttempt !== expectedAttempt) {
    throw new Error(`Attempt changed: planner saw ${expectedAttempt}, GitHub has ${currentAttempt}.`);
  }
  if (currentAttempt >= maxAttempts) throw new Error('Attempt circuit breaker reached.');
  return [
    ...labels.filter((label) => !label.startsWith(attemptPrefix) && !label.startsWith(riskPrefix)),
    lockLabel,
    watchLabel,
    `${attemptPrefix}${currentAttempt + 1}`,
    `${riskPrefix}${risk}`,
  ].filter((label, index, all) => all.indexOf(label) === index);
}

function releaseLabels(labels, lockLabel = 'loop:repairing') {
  return labels.filter((label) => label !== lockLabel);
}

function selectedFromDecision(decision, repository, maxAttempts = 3) {
  if (decision.state !== 'selected' || !decision.selected) throw new Error('Decision does not select a target.');
  if (decision.repository !== repository) throw new Error('Decision repository does not match --repository.');
  const selected = decision.selected;
  if (!['issue', 'pull-request'].includes(selected.type)) throw new Error('Selected target type is invalid.');
  if (!Number.isInteger(selected.number) || selected.number <= 0) throw new Error('Selected target number is invalid.');
  if (!Number.isInteger(selected.attempts) || selected.attempts < 0 || selected.attempts >= maxAttempts) {
    throw new Error('Selected target attempt is invalid or exhausted.');
  }
  if (selected.type === 'pull-request' && !/^[0-9a-f]{40}$/.test(selected.headSha ?? '')) {
    throw new Error('Selected pull request requires a full lowercase HEAD SHA.');
  }
  return selected;
}

function openLocks(repository, lockLabel) {
  const pages = ghJson(['api', `repos/${repository}/issues?state=open&per_page=100`, '--paginate', '--slurp']);
  return pages.flat().filter((item) => labelsOf(item).includes(lockLabel)).map((item) => item.number);
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
  const selected = selectedFromDecision(decision, args.repository, args.maxAttempts);
  const target = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
  const currentLabels = labelsOf(target);

  if (args.release) {
    const desired = releaseLabels(currentLabels, args.lockLabel);
    if (args.execute && desired.length !== currentLabels.length) patchLabels(args.repository, selected.number, desired);
    console.log(JSON.stringify({ action: 'release', executed: args.execute, target: selected.number, labels: desired }));
    return;
  }

  validateHead(args.repository, selected);
  const locks = openLocks(args.repository, args.lockLabel);
  if (locks.length > 0) throw new Error(`Global repair lock already held by #${locks.join(', #')}.`);
  const refreshed = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
  const policy = {
    lockLabel: args.lockLabel,
    watchLabel: args.watchLabel,
    attemptPrefix: args.attemptPrefix,
    riskPrefix: args.riskPrefix,
    maxAttempts: args.maxAttempts,
  };
  const desired = claimLabels(labelsOf(refreshed), args.risk, selected.attempts, policy);
  if (!args.execute) {
    console.log(JSON.stringify({ action: 'claim', executed: false, target: selected.number, labels: desired }));
    return;
  }
  patchLabels(args.repository, selected.number, desired);
  const verifiedLocks = openLocks(args.repository, args.lockLabel);
  if (verifiedLocks.length !== 1 || verifiedLocks[0] !== selected.number) {
    const latest = ghJson(['api', `repos/${args.repository}/issues/${selected.number}`]);
    patchLabels(args.repository, selected.number, releaseLabels(labelsOf(latest), args.lockLabel));
    throw new Error(`Could not acquire sole repair lock; observed #${verifiedLocks.join(', #')}.`);
  }
  console.log(JSON.stringify({ action: 'claim', executed: true, target: selected.number, labels: desired }));
}

function isMain(metaUrl, entrypoint) {
  return Boolean(entrypoint) && realpathSync(fileURLToPath(metaUrl)) === realpathSync(entrypoint);
}

if (isMain(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { claimLabels, isMain, parseArgs, parseAttempt, releaseLabels, selectedFromDecision };
