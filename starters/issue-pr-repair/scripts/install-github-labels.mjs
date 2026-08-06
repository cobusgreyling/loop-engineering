#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function usage() {
  console.log(`install-github-labels — install default Issue + PR Repair labels

Usage:
  node scripts/install-github-labels.mjs --repository owner/repo [--max-attempts 3] [--execute]

Dry-run is the default. Existing labels are never modified.
`);
}

function labelDefinitions(maxAttempts = 3) {
  return [
    ['bug', 'd73a4a', 'Confirmed or suspected product defect'],
    ['loop-pause-all', 'b60205', 'Kill switch for unattended repair loops'],
    ['loop:repairing', 'fbca04', 'Repository-wide repair lease'],
    ['loop:watch', '0e8a16', 'Target managed by the repair loop'],
    ['loop:reproduced', '0e8a16', 'Deterministic reproduction is recorded'],
    ['loop:repro-failed', 'd4c5f9', 'Automated reproduction did not succeed'],
    ['loop:automerge', '1d76db', 'Explicit authorization for gated low-risk merge'],
    ...Array.from({ length: maxAttempts }, (_, index) => [
      `loop:attempts:${index + 1}`,
      'cfd3d7',
      `Repair circuit-breaker attempt ${index + 1}/${maxAttempts}`,
    ]),
    ...['deterministic', 'flake', 'infrastructure'].map((kind) => [
      `loop:failure:${kind}`,
      kind === 'deterministic' ? 'd73a4a' : 'fef2c0',
      `Failure classified as ${kind}`,
    ]),
    ...['critical', 'high', 'medium', 'low'].map((priority) => [
      `priority:${priority}`,
      priority === 'critical' ? 'b60205' : priority === 'high' ? 'd93f0b' : 'fbca04',
      `${priority} repair priority`,
    ]),
    ...['low', 'medium', 'high', 'critical'].map((risk) => [
      `risk:${risk}`,
      risk === 'critical' ? 'b60205' : risk === 'high' ? 'd93f0b' : risk === 'medium' ? 'fbca04' : '0e8a16',
      `${risk} change risk`,
    ]),
    ['security', 'b60205', 'Security-sensitive work; human required'],
    ...['auth', 'billing', 'migrations', 'deployment', 'release'].map((area) => [
      `area:${area}`,
      'b60205',
      `${area} area; human required`,
    ]),
  ];
}

function parseArgs(argv) {
  const result = { execute: false, maxAttempts: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--repository') {
      const repository = argv[++index];
      if (!repository || repository.startsWith('--')) throw new Error('--repository requires a value.');
      result.repository = repository;
    } else if (value === '--max-attempts') {
      result.maxAttempts = Number(argv[++index]);
    } else if (value === '--execute') result.execute = true;
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!result.help && !result.repository) throw new Error('--repository is required.');
  if (!Number.isInteger(result.maxAttempts) || result.maxAttempts < 1) {
    throw new Error('--max-attempts must be a positive integer.');
  }
  return result;
}

function runGh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function labelExists(repository, name) {
  const result = runGh(['api', `repos/${repository}/labels/${encodeURIComponent(name)}`, '--silent']);
  if (result.status === 0) return true;
  if (/HTTP 404|Not Found/i.test(result.stderr)) return false;
  throw new Error(result.stderr.trim() || `Could not inspect GitHub label ${name}.`);
}

function createLabel(repository, [name, color, description]) {
  const result = runGh([
    'label', 'create', name, '--repo', repository,
    '--color', color, '--description', description,
  ]);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `Could not create GitHub label ${name}.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const labels = labelDefinitions(args.maxAttempts);
  if (!args.execute) {
    console.log(JSON.stringify({ action: 'install-labels', executed: false, repository: args.repository, labels }));
    return;
  }
  const created = [];
  const existing = [];
  for (const label of labels) {
    if (labelExists(args.repository, label[0])) existing.push(label[0]);
    else {
      createLabel(args.repository, label);
      created.push(label[0]);
    }
  }
  console.log(JSON.stringify({ action: 'install-labels', executed: true, repository: args.repository, created, existing }));
}

function isMain(metaUrl, entrypoint) {
  return Boolean(entrypoint) && realpathSync(fileURLToPath(metaUrl)) === realpathSync(entrypoint);
}

if (isMain(import.meta.url, process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { isMain, labelDefinitions, parseArgs };
