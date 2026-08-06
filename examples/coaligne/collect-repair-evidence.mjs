#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function usage() {
  console.log(`collect-repair-evidence — trusted GitHub intake for coAligne

Usage:
  node collect-repair-evidence.mjs --repository owner/repo --output <file> [options]

Options:
  --owned-prefix <prefix>  Branch prefix Codex may push (default: codex/)
  --required-check <name>  Required check to classify
`);
}

function parseArgs(argv) {
  const result = { ownedPrefix: 'codex/', requiredCheck: 'continuous-integration/drone/pr' };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--repository') result.repository = argv[++index];
    else if (value === '--output') result.output = argv[++index];
    else if (value === '--owned-prefix') result.ownedPrefix = argv[++index];
    else if (value === '--required-check') result.requiredCheck = argv[++index];
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!result.help && (!result.repository || !result.output)) {
    throw new Error('--repository and --output are required.');
  }
  return result;
}

function ghJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed.`);
  return JSON.parse(result.stdout);
}

function apiPages(endpoint, headers = []) {
  const args = ['api', endpoint, '--paginate', '--slurp'];
  for (const header of headers) args.push('-H', header);
  return ghJson(args).flat();
}

function labelsOf(item) {
  return (item.labels ?? []).map((label) => typeof label === 'string' ? label : label.name);
}

function normalizeStatus(state, conclusion) {
  const pending = ['queued', 'in_progress', 'pending', 'requested', 'waiting'];
  const normalizedState = String(state ?? '').toLowerCase();
  const terminal = String(conclusion ?? state ?? '').toLowerCase();
  if (pending.includes(normalizedState)) return 'pending';
  if (['success', 'neutral', 'skipped'].includes(terminal)) return 'success';
  if (['failure', 'error', 'cancelled', 'timed_out', 'action_required', 'stale'].includes(terminal)) return 'failure';
  return 'absent';
}

function failureClassFromLabels(labels) {
  for (const kind of ['deterministic', 'flake', 'infrastructure']) {
    if (labels.includes(`loop:failure:${kind}`)) return kind;
  }
  return 'unknown';
}

function reproductionFromLabels(labels) {
  if (labels.includes('loop:reproduced')) return 'confirmed';
  if (labels.includes('loop:repro-failed')) return 'failed';
  return 'unknown';
}

function latestReviewsByAuthor(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login || ['COMMENTED', 'PENDING'].includes(review.state)) continue;
    const previous = latest.get(login);
    if (!previous || Date.parse(review.submitted_at ?? 0) >= Date.parse(previous.submitted_at ?? 0)) {
      latest.set(login, review);
    }
  }
  return [...latest.values()];
}

function linkedPrFromTimeline(events) {
  return events
    .filter((event) => event.event === 'cross-referenced' && event.source?.issue?.pull_request)
    .filter((event) => event.source.issue.state === 'open')
    .map((event) => event.source.issue.number)
    .find((number) => Number.isInteger(number));
}

function requiredCheck(repository, sha, name) {
  const statuses = ghJson(['api', `repos/${repository}/commits/${sha}/status`]).statuses ?? [];
  const runs = ghJson(['api', `repos/${repository}/commits/${sha}/check-runs?per_page=100`]).check_runs ?? [];
  const status = statuses.find((item) => item.context === name);
  if (status) return normalizeStatus(status.state);
  const run = runs.find((item) => item.name === name);
  return run ? normalizeStatus(run.status, run.conclusion) : 'absent';
}

function collectIssue(repository, issue) {
  const labels = labelsOf(issue);
  const timeline = apiPages(
    `repos/${repository}/issues/${issue.number}/timeline?per_page=100`,
    ['Accept: application/vnd.github+json'],
  );
  return {
    type: 'issue',
    number: issue.number,
    title: issue.title,
    updatedAt: issue.updated_at,
    labels,
    linkedPullRequest: linkedPrFromTimeline(timeline),
    reproduction: reproductionFromLabels(labels),
  };
}

function collectPull(repository, pull, args) {
  const labels = labelsOf(pull);
  const reviews = apiPages(`repos/${repository}/pulls/${pull.number}/reviews?per_page=100`);
  const latestReviews = latestReviewsByAuthor(reviews);
  const files = apiPages(`repos/${repository}/pulls/${pull.number}/files?per_page=100`);
  return {
    type: 'pull-request',
    number: pull.number,
    title: pull.title,
    updatedAt: pull.updated_at,
    labels,
    changedPaths: files.map((file) => file.filename),
    headSha: pull.head.sha,
    branchOwned: pull.head.repo?.full_name === repository && pull.head.ref.startsWith(args.ownedPrefix),
    reviewActionable: latestReviews.some((review) => review.state === 'CHANGES_REQUESTED'),
    check: {
      status: requiredCheck(repository, pull.head.sha, args.requiredCheck),
      failureClass: failureClassFromLabels(labels),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const issueRecords = apiPages(`repos/${args.repository}/issues?state=open&per_page=100`);
  const issues = issueRecords.filter((item) => !item.pull_request);
  const pulls = apiPages(`repos/${args.repository}/pulls?state=open&per_page=100`);
  const pauseIssues = issues
    .filter((issue) => labelsOf(issue).includes('loop-pause-all'))
    .map((issue) => issue.number);
  const bugIssues = issues.filter((issue) => labelsOf(issue).includes('bug'));
  const targets = [
    ...bugIssues.map((issue) => collectIssue(args.repository, issue)),
    ...pulls.map((pull) => collectPull(args.repository, pull, args)),
  ];
  const evidence = {
    version: 1,
    observedAt: new Date().toISOString(),
    repository: args.repository,
    pauseIssues,
    targets,
  };
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`wrote ${args.output}: ${bugIssues.length} bug issue(s), ${pulls.length} PR(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  failureClassFromLabels,
  latestReviewsByAuthor,
  linkedPrFromTimeline,
  normalizeStatus,
  reproductionFromLabels,
};
