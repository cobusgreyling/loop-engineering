#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

function usage() {
  console.log(`trigger-drone-promotion — test an exact PR revision with trusted Drone config

Usage:
  node trigger-drone-promotion.mjs --repository owner/repo --pr 42 --sha <sha> [options]

Options:
  --environment <name>  Promotion target (default: coaligne-test)
  --trusted-branch <b>  Branch supplying trusted pipeline config (default: main)
  --execute             Call Drone; otherwise report the planned action
`);
}

function parseArgs(argv) {
  const args = { environment: 'coaligne-test', trustedBranch: 'main', execute: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--repository') args.repository = argv[++i];
    else if (value === '--pr') args.pr = Number(argv[++i]);
    else if (value === '--sha') args.sha = argv[++i];
    else if (value === '--environment') args.environment = argv[++i];
    else if (value === '--trusted-branch') args.trustedBranch = argv[++i];
    else if (value === '--execute') args.execute = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.help && (!args.repository || !args.pr || !args.sha)) {
    throw new Error('--repository, --pr, and --sha are required.');
  }
  return args;
}

function buildParameter(build, name) {
  return build.params?.[name] ?? build.parameters?.[name];
}

function selectBuild(builds, sha, pr, trustedBranch = 'main') {
  const matching = builds.filter((build) => build.after === sha || build.commit === sha);
  const existing = builds.find(
    (build) => build.event === 'promote' && buildParameter(build, 'LOOP_REVISION') === sha,
  );
  if (existing) return { kind: 'existing', build: existing };
  const candidate = matching
    .filter(
      (build) =>
        build.event === 'pull_request' &&
        build.status === 'success' &&
        (build.pull_request === undefined || Number(build.pull_request) === pr),
    )
    .sort((left, right) => Number(right.number) - Number(left.number))[0];
  if (!candidate) return { kind: 'missing-candidate' };
  const trusted = builds
    .filter(
      (build) =>
        build.status === 'success' &&
        ['push', 'custom'].includes(build.event) &&
        (build.source === trustedBranch || build.ref === `refs/heads/${trustedBranch}`),
    )
    .sort((left, right) => Number(right.number) - Number(left.number))[0];
  return trusted
    ? { kind: 'source', build: trusted, candidateBuild: candidate }
    : { kind: 'missing-trusted' };
}

async function droneRequest(server, token, pathname, method = 'GET') {
  const response = await fetch(`${server.replace(/\/$/, '')}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Drone ${method} ${pathname} failed (${response.status}): ${body}`);
  return body ? JSON.parse(body) : undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const server = process.env.DRONE_SERVER;
  const token = process.env.DRONE_TOKEN;
  if (!server || !token) throw new Error('DRONE_SERVER and DRONE_TOKEN are required.');
  if (!/^[0-9a-f]{40}$/.test(args.sha)) throw new Error('--sha must be a full lowercase GitHub SHA.');
  const [owner, repo, extra] = args.repository.split('/');
  if (!owner || !repo || extra) throw new Error(`Invalid repository: ${args.repository}`);
  const base = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/builds`;
  const builds = await droneRequest(server, token, base);
  const selected = selectBuild(builds, args.sha, args.pr, args.trustedBranch);
  if (selected.kind === 'existing') {
    console.log(`promotion already exists: Drone build ${selected.build.number} (${selected.build.status})`);
    return;
  }
  if (selected.kind === 'missing-candidate') {
    throw new Error(`No successful Drone pull_request build found for PR #${args.pr} at ${args.sha}.`);
  }
  if (selected.kind === 'missing-trusted') {
    throw new Error(`No successful Drone build found on trusted branch ${args.trustedBranch}.`);
  }
  if (!args.execute) {
    console.log(
      `dry-run: would use trusted Drone build ${selected.build.number} to test ${args.sha} in ${args.environment}`,
    );
    return;
  }
  const query = new URLSearchParams({
    target: args.environment,
    LOOP_REVISION: args.sha,
    LOOP_PR: String(args.pr),
  });
  const promoted = await droneRequest(
    server,
    token,
    `${base}/${selected.build.number}/promote?${query}`,
    'POST',
  );
  console.log(`started Drone promotion build ${promoted.number} for ${args.sha} → ${args.environment}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { parseArgs, selectBuild };
