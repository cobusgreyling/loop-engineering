#!/usr/bin/env node
/**
 * Inspect live GitHub (open PRs + issues) and write STATE.md High Priority
 * from that signal — not from the Loop Ready score.
 *
 *   node scripts/github-triage.mjs --score 100 --level L3 --out-md STATE.md
 *
 * Tests pass fixture JSON via --prs-json / --issues-json (no network).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const DAY = 24 * 60 * 60 * 1000;

export function parseArgs(argv) {
  const out = {
    score: '—',
    level: '—',
    failingWorkflows: 0,
    outMd: '',
    outJson: '',
    prsJson: '',
    issuesJson: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--score') out.score = next();
    else if (a === '--level') out.level = next();
    else if (a === '--failing-workflows') out.failingWorkflows = Number(next()) || 0;
    else if (a === '--out-md') out.outMd = next();
    else if (a === '--out-json') out.outJson = next();
    else if (a === '--prs-json') out.prsJson = next();
    else if (a === '--issues-json') out.issuesJson = next();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function labelsOf(item) {
  return (item.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
}

function commentCount(issue) {
  if (typeof issue.comments === 'number') return issue.comments;
  if (Array.isArray(issue.comments)) return issue.comments.length;
  if (typeof issue.commentsCount === 'number') return issue.commentsCount;
  return 0;
}

function ageMs(iso, now) {
  if (!iso) return 0;
  return Math.max(0, now - new Date(iso).getTime());
}

function checksOf(pr) {
  const rollup = pr.statusCheckRollup || [];
  const fail = rollup.filter((c) => c.conclusion === 'FAILURE' || c.conclusion === 'ERROR');
  const pending = rollup.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'QUEUED' || (!c.conclusion && c.status !== 'COMPLETED'),
  );
  return { total: rollup.length, fail, pending };
}

/**
 * Classify one open PR. Returns { bucket: 'high'|'watch'|'noise', line }.
 */
export function classifyPr(pr, now = Date.now()) {
  const n = `#${pr.number}`;
  const title = (pr.title || '').replace(/\s+/g, ' ').trim();
  const url = pr.url || '';
  const link = url ? `[${n}](${url})` : n;
  const mss = pr.mergeStateStatus || '';
  const { total, fail } = checksOf(pr);
  const author = pr.author?.login || pr.author?.name || 'unknown';

  if (pr.isDraft) {
    const stale = ageMs(pr.updatedAt || pr.createdAt, now) > 30 * DAY;
    return {
      bucket: stale ? 'watch' : 'noise',
      line: `- Draft ${link} ${title} (@${author}${stale ? '; idle >30d' : ''})`,
    };
  }

  if (mss === 'DIRTY' || pr.mergeable === 'CONFLICTING') {
    return { bucket: 'high', line: `- ${link} **conflicts** — ${title}` };
  }
  if (fail.length > 0) {
    const names = fail.map((c) => c.name).filter(Boolean).slice(0, 3).join(', ');
    return { bucket: 'high', line: `- ${link} **CI red** (${names || fail.length} failing) — ${title}` };
  }
  if (total === 0) {
    return {
      bucket: 'high',
      line: `- ${link} **no CI** (fork workflow likely waiting for approval) — ${title}`,
    };
  }
  if (mss === 'BLOCKED') {
    return { bucket: 'high', line: `- ${link} **blocked** (missing required checks or review) — ${title}` };
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return { bucket: 'high', line: `- ${link} **changes requested** — ${title}` };
  }
  if (mss === 'UNSTABLE') {
    return { bucket: 'watch', line: `- ${link} merge UNSTABLE — ${title}` };
  }
  if (mss === 'CLEAN' || mss === 'HAS_HOOKS' || mss === 'BEHIND') {
    return { bucket: 'watch', line: `- ${link} CI green, waiting on review/merge — ${title}` };
  }
  return { bucket: 'watch', line: `- ${link} ${mss || 'open'} — ${title}` };
}

/**
 * Classify one open issue.
 */
export function classifyIssue(issue, now = Date.now()) {
  const n = `#${issue.number}`;
  const title = (issue.title || '').replace(/\s+/g, ' ').trim();
  const url = issue.url || '';
  const link = url ? `[${n}](${url})` : n;
  const labels = labelsOf(issue);
  const comments = commentCount(issue);
  const age = ageMs(issue.createdAt, now);
  const idle = ageMs(issue.updatedAt || issue.createdAt, now);
  const author = issue.author?.login || 'unknown';
  const isBot = Boolean(issue.author?.is_bot) || /\[bot\]$/.test(author) || author === 'app/github-actions';

  if (labels.includes('good first issue') && age > 21 * DAY) {
    return {
      bucket: 'watch',
      line: `- ${link} stale **good first issue** (${Math.floor(age / DAY)}d) — ${title}`,
    };
  }
  if (labels.includes('loop-report') || labels.includes('release-prep')) {
    return {
      bucket: idle > 21 * DAY ? 'watch' : 'noise',
      line: `- ${link} ${labels.includes('release-prep') ? 'release-prep' : 'loop-report'} — ${title}`,
    };
  }
  if (!isBot && comments === 0 && age > 7 * DAY) {
    return {
      bucket: 'high',
      line: `- ${link} **unanswered** ${Math.floor(age / DAY)}d — ${title}`,
    };
  }
  if (!isBot && idle > 14 * DAY) {
    return {
      bucket: 'watch',
      line: `- ${link} idle ${Math.floor(idle / DAY)}d — ${title}`,
    };
  }
  return { bucket: 'noise', line: `- ${link} ${title}` };
}

export function buildSections({ prs = [], issues = [] }, now = Date.now()) {
  const high = [];
  const watch = [];
  const noise = [];
  const push = (item) => {
    if (item.bucket === 'high') high.push(item.line);
    else if (item.bucket === 'watch') watch.push(item.line);
    else noise.push(item.line);
  };
  for (const pr of prs) push(classifyPr(pr, now));
  for (const issue of issues) push(classifyIssue(issue, now));
  return { high, watch, noise };
}

export function renderState({ high, watch, noise, score, level, date, failingWorkflows = 0 }) {
  const extraHigh =
    failingWorkflows > 0
      ? [
          `- **${failingWorkflows}** dogfood workflow(s) failing — investigate \`validate-patterns\` / \`audit\`.`,
        ]
      : [];
  const highLines = [...extraHigh, ...high];
  const highBody =
    highLines.length > 0
      ? highLines.join('\n')
      : '- No blocked PRs, failing checks, or unanswered issues.';
  const watchBody =
    watch.length > 0
      ? watch.join('\n')
      : '- Expand contributor failure stories (dependency sweeper, multi-loop).\n- Collect a production story for Post-Merge Cleanup.';
  const noiseBody = noise.length > 0 ? noise.slice(0, 8).join('\n') : '—';
  const scoreNote =
    Number(score) < 58
      ? `- Loop Ready **${score}** (${level}) is below the 58 floor — investigate audit gaps.`
      : `- Loop Ready **${score}** (${level}) — informational, not a reason to act.`;

  return `# Loop State — loop-engineering reference

Last run: ${date} (automated daily-triage workflow)

## High Priority (loop is acting or waiting on human)

${highBody}
${Number(score) < 58 ? `${scoreNote}\n` : ''}
## Watch List

${watchBody}
${Number(score) >= 58 ? `\n${scoreNote}` : ''}

## Recent Noise (ignored this run)

${noiseBody}

---
Run log: Updated by \`.github/workflows/daily-triage.yml\` via \`scripts/github-triage.mjs\`. See \`LOOP.md\` for cadence and gates.
`;
}

async function ghJson(args) {
  const { stdout } = await exec('gh', args, { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function loadList(pathOrEmpty, fetcher) {
  if (pathOrEmpty) {
    return JSON.parse(await readFile(pathOrEmpty, 'utf8'));
  }
  return fetcher();
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: github-triage.mjs [--score N] [--level L] [--out-md FILE] [--out-json FILE] [--prs-json FILE] [--issues-json FILE]',
    );
    return 0;
  }

  const prs = await loadList(args.prsJson, () =>
    ghJson([
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      'number,title,url,isDraft,mergeStateStatus,mergeable,reviewDecision,statusCheckRollup,author,updatedAt,createdAt',
    ]),
  );
  const issues = await loadList(args.issuesJson, () =>
    ghJson([
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      'number,title,url,labels,createdAt,updatedAt,author,comments',
    ]),
  );

  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sections = buildSections({ prs, issues });
  const md = renderState({
    ...sections,
    score: args.score,
    level: args.level,
    date,
    failingWorkflows: args.failingWorkflows,
  });
  const summary = {
    high: sections.high.length,
    watch: sections.watch.length,
    noise: sections.noise.length,
    items_found: sections.high.length + sections.watch.length,
  };

  if (args.outMd) await writeFile(args.outMd, md);
  else process.stdout.write(md);
  if (args.outJson) await writeFile(args.outJson, JSON.stringify(summary, null, 2) + '\n');
  console.error(
    `github-triage: high=${summary.high} watch=${summary.watch} noise=${summary.noise}`,
  );
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
