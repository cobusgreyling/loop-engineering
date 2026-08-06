#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function usage() {
  console.log(`collect-promotion-evidence — GitHub adapter for the coAligne demo

Usage:
  node collect-promotion-evidence.mjs --repository owner/repo --output <dir> [options]

Options:
  --pr <number>                Collect one PR
  --all-open                   Include open PRs without loop:automerge
  --environment <name>        Deployment environment (default: coaligne-test)
  --dataset-version <version> Expected test dataset (default: coaligne-acceptance-v1)
  --receipt-actor <login>     Trusted deployment/data/E2E status issuer
  --ci-actor <login>          Trusted Drone status issuer
  --ci-target-prefix <url>    Trusted Drone status URL prefix (legacy statuses)
  --acceptance-actors <list>  Comma-separated manual acceptance issuers
`);
}

function parseArgs(argv) {
  const result = {
    environment: 'coaligne-test',
    datasetVersion: 'coaligne-acceptance-v1',
    allOpen: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--repository') result.repository = argv[++i];
    else if (value === '--output') result.output = argv[++i];
    else if (value === '--pr') result.pr = Number(argv[++i]);
    else if (value === '--environment') result.environment = argv[++i];
    else if (value === '--dataset-version') result.datasetVersion = argv[++i];
    else if (value === '--receipt-actor') result.receiptActor = argv[++i];
    else if (value === '--ci-actor') result.ciActor = argv[++i];
    else if (value === '--ci-target-prefix') result.ciTargetPrefix = argv[++i];
    else if (value === '--acceptance-actors') {
      result.acceptanceActors = argv[++i].split(',').map((actor) => actor.trim()).filter(Boolean);
    }
    else if (value === '--all-open') result.allOpen = true;
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!result.help && (!result.repository || !result.output)) {
    throw new Error('--repository and --output are required.');
  }
  if (result.pr !== undefined && (!Number.isInteger(result.pr) || result.pr <= 0)) {
    throw new Error('--pr must be a positive integer.');
  }
  return result;
}

function ghJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed.`);
  return JSON.parse(result.stdout);
}

function apiPages(endpoint) {
  const pages = ghJson(['api', endpoint, '--paginate', '--slurp']);
  return pages.flat();
}

function normalizeStatus(state, conclusion) {
  const normalizedState = String(state ?? '').toLowerCase();
  const normalizedConclusion = String(conclusion ?? '').toLowerCase();
  if (['queued', 'in_progress', 'pending', 'requested', 'waiting'].includes(normalizedState)) {
    return 'pending';
  }
  const terminal = normalizedConclusion || normalizedState;
  if (['success', 'neutral', 'skipped'].includes(terminal)) return 'success';
  if (['failure', 'error', 'cancelled', 'timed_out', 'action_required', 'stale'].includes(terminal)) {
    return 'failure';
  }
  return 'pending';
}

function latestReviewsByAuthor(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login || review.state === 'COMMENTED' || review.state === 'PENDING') continue;
    const previous = latest.get(login);
    const submitted = Date.parse(review.submitted_at ?? 0);
    const previousSubmitted = Date.parse(previous?.submitted_at ?? 0);
    if (!previous || submitted >= previousSubmitted) latest.set(login, review);
  }
  return [...latest.values()];
}

function riskFromLabels(labels) {
  for (const level of ['critical', 'high', 'medium', 'low']) {
    if (labels.includes(`risk:${level}`)) return level;
  }
  return 'unclassified';
}

function attemptsFromLabels(labels) {
  for (const label of labels) {
    const match = /^loop:attempts:(\d+)$/.exec(label);
    if (match) return Number(match[1]);
  }
  return 0;
}

function selectPulls(pulls, args) {
  if (args.pr) return pulls;
  return pulls.filter(
    (pull) => args.allOpen || (pull.labels ?? []).some((label) => label.name === 'loop:automerge'),
  );
}

function repositoryParts(repository) {
  const [owner, repo, extra] = repository.split('/');
  if (!owner || !repo || extra) throw new Error(`Invalid repository: ${repository}. Use owner/repo.`);
  return { owner, repo };
}

function unresolvedThreads(owner, repo, number) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes { isResolved }
            pageInfo { hasNextPage }
          }
        }
      }
    }
  `;
  const result = ghJson([
    'api',
    'graphql',
    '-f', `query=${query}`,
    '-f', `owner=${owner}`,
    '-f', `repo=${repo}`,
    '-F', `number=${number}`,
  ]);
  const threads = result.data.repository.pullRequest.reviewThreads;
  // More than 100 threads is itself a reason to hold for a human instead of
  // accidentally treating an uninspected page as resolved.
  return threads.nodes.filter((thread) => !thread.isResolved).length + (threads.pageInfo.hasNextPage ? 1 : 0);
}

function collectChecks(repository, sha) {
  const combined = ghJson(['api', `repos/${repository}/commits/${sha}/status`]);
  const runs = ghJson(['api', `repos/${repository}/commits/${sha}/check-runs?per_page=100`]);
  const checks = new Map();
  for (const context of combined.statuses ?? []) {
    checks.set(context.context, {
      name: context.context,
      status: normalizeStatus(context.state),
      sha,
      completedAt: context.updated_at ?? undefined,
      url: context.target_url ?? undefined,
      issuer: context.creator?.login,
    });
  }
  for (const run of runs.check_runs ?? []) {
    checks.set(run.name, {
      name: run.name,
      status: normalizeStatus(run.status, run.conclusion),
      sha,
      completedAt: run.completed_at ?? undefined,
      url: run.html_url ?? undefined,
      issuer: run.app?.slug ?? run.app?.owner?.login,
    });
  }
  return [...checks.values()];
}

function matchesUrlPrefix(value, prefix) {
  if (!value || !prefix) return false;
  try {
    const url = new URL(value);
    const trusted = new URL(prefix);
    const basePath = trusted.pathname.replace(/\/+$/, '');
    return (
      url.protocol === trusted.protocol &&
      url.host === trusted.host &&
      (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))
    );
  } catch {
    return false;
  }
}

function isTrustedCiCheck(check, ciActor, ciTargetPrefix) {
  return Boolean(
    (ciActor && check.issuer === ciActor) ||
    (ciTargetPrefix && matchesUrlPrefix(check.url, ciTargetPrefix)),
  );
}

function collectDeployment(repository, sha, environment, receiptActor) {
  if (!receiptActor) return undefined;
  const deployments = ghJson([
    'api',
    `repos/${repository}/deployments?sha=${encodeURIComponent(sha)}&environment=${encodeURIComponent(environment)}&per_page=100`,
  ]);
  const deployment = deployments.find((item) => item.creator?.login === receiptActor);
  if (!deployment) return undefined;
  const statuses = ghJson(['api', `repos/${repository}/deployments/${deployment.id}/statuses?per_page=100`]);
  const status = statuses.find((item) => item.creator?.login === receiptActor);
  if (!status) return undefined;
  return {
    environment,
    status: normalizeStatus(status.state),
    sha: deployment.sha,
    completedAt: status.updated_at,
    url: status.environment_url || status.target_url || undefined,
  };
}

function collectExecutionEvidence(
  checks,
  sha,
  datasetVersion,
  receiptActor,
) {
  const trustedChecks = receiptActor
    ? checks.filter((check) => check.issuer === receiptActor)
    : [];
  const dataCheck = trustedChecks.find(
    (check) => check.name === `loop/test-data/${datasetVersion}`,
  );
  const testData = dataCheck
    ? {
        kind: 'synthetic',
        version: datasetVersion,
        status: dataCheck.status,
        sha,
        completedAt: dataCheck.completedAt,
      }
    : undefined;
  const e2e = trustedChecks
    .filter((check) => check.name.startsWith('loop/e2e/'))
    .map((check) => ({
      suite: check.name.slice('loop/e2e/'.length),
      status: check.status,
      sha,
      datasetVersion,
      completedAt: check.completedAt,
      url: check.url,
    }));
  return { testData, e2e };
}

function collectManualAcceptance(comments, sha, acceptanceActors = []) {
  const command = `/loop accept ${sha}`;
  const accepted = comments
    .filter(
      (comment) =>
        acceptanceActors.includes(comment.user?.login) && comment.body?.trim() === command,
    )
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
  return accepted
    ? {
        status: 'success',
        sha,
        completedAt: accepted.updated_at,
        actor: accepted.user.login,
      }
    : undefined;
}

async function collectOne(repository, args, number) {
  const { owner, repo } = repositoryParts(repository);
  const pr = ghJson(['api', `repos/${repository}/pulls/${number}`]);
  const sha = pr.head.sha;
  const labels = (pr.labels ?? []).map((label) => label.name);
  const files = apiPages(`repos/${repository}/pulls/${number}/files?per_page=100`);
  const reviews = apiPages(`repos/${repository}/pulls/${number}/reviews?per_page=100`);
  const latestReviews = latestReviewsByAuthor(reviews);
  const approvals = latestReviews.filter((review) => review.state === 'APPROVED' && review.commit_id === sha);
  const changesRequested = latestReviews.some((review) => review.state === 'CHANGES_REQUESTED');
  const collectedChecks = collectChecks(repository, sha);
  const checks = collectedChecks.filter(
    (check) =>
      check.name !== 'continuous-integration/drone/pr' ||
      isTrustedCiCheck(check, args.ciActor, args.ciTargetPrefix),
  );
  const execution = collectExecutionEvidence(
    checks,
    sha,
    args.datasetVersion,
    args.receiptActor,
  );
  const comments = args.acceptanceActors?.length
    ? apiPages(`repos/${repository}/issues/${number}/comments?per_page=100`)
    : [];
  const manualAcceptance = collectManualAcceptance(comments, sha, args.acceptanceActors);

  return {
    version: 1,
    observedAt: new Date().toISOString(),
    pullRequest: {
      number,
      headSha: sha,
      baseBranch: pr.base.ref,
      baseRepository: pr.base.repo.full_name,
      headRepository: pr.head.repo?.full_name ?? 'unknown/fork',
      draft: Boolean(pr.draft),
      mergeState: String(pr.mergeable_state ?? 'UNKNOWN').toUpperCase(),
      labels,
      approvals: approvals.length,
      approvalSha: approvals.length > 0 ? sha : undefined,
      changesRequested,
      unresolvedThreads: unresolvedThreads(owner, repo, number),
      attempts: attemptsFromLabels(labels),
      riskLevel: riskFromLabels(labels),
      changedPaths: files.map((file) => file.filename),
    },
    checks,
    deployment: collectDeployment(repository, sha, args.environment, args.receiptActor),
    testData: execution.testData,
    e2e: execution.e2e,
    manualAcceptance,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  await mkdir(args.output, { recursive: true });
  if (!args.receiptActor) console.warn('Machine receipts disabled: --receipt-actor is not configured.');
  if (!args.ciActor && !args.ciTargetPrefix) {
    console.warn('Drone check disabled: configure --ci-actor or --ci-target-prefix.');
  }
  const pulls = args.pr
    ? [{ number: args.pr, labels: [] }]
    : apiPages(`repos/${args.repository}/pulls?state=open&per_page=100`);
  const selected = selectPulls(pulls, args);

  for (const pull of selected) {
    const evidence = await collectOne(args.repository, args, pull.number);
    const file = path.join(args.output, `pr-${pull.number}.json`);
    await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`wrote ${file} @ ${evidence.pullRequest.headSha}`);
  }
  if (selected.length === 0) console.log('No watched PRs; early exit.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  collectExecutionEvidence,
  collectManualAcceptance,
  isTrustedCiCheck,
  matchesUrlPrefix,
  normalizeStatus,
  selectPulls,
};
