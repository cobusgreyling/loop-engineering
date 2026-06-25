#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const MONOREPO_STARTERS = path.resolve(PACKAGE_ROOT, '../../starters');
const MONOREPO_TEMPLATES = path.resolve(PACKAGE_ROOT, '../../templates');
const PATTERN_STARTERS = {
    'daily-triage': 'minimal-loop',
    'pr-babysitter': 'pr-babysitter',
    'ci-sweeper': 'ci-sweeper',
    'dependency-sweeper': 'dependency-sweeper',
    'post-merge-cleanup': 'post-merge-cleanup',
    'changelog-drafter': 'changelog-drafter',
    'issue-triage': 'issue-triage',
};
const TOOL_SUFFIX = {
    grok: '',
    claude: '-claude',
    codex: '-codex',
};
const L2_PATTERNS = new Set(['ci-sweeper', 'dependency-sweeper']);
const PATTERNS_NEEDING_FIX = new Set([
    'pr-babysitter',
    'ci-sweeper',
    'dependency-sweeper',
    'post-merge-cleanup',
]);
const STATE_FILES = {
    'daily-triage': 'STATE.md',
    'pr-babysitter': 'pr-babysitter-state.md',
    'ci-sweeper': 'ci-sweeper-state.md',
    'dependency-sweeper': 'dependency-sweeper-state.md',
    'post-merge-cleanup': 'post-merge-state.md',
    'changelog-drafter': 'changelog-drafter-state.md',
    'issue-triage': 'issue-triage-state.md',
};
/** Mirrors patterns/registry.yaml cost caps — used when scaffolding observability files. */
const PATTERN_BUDGET = {
    'daily-triage': { name: 'Daily Triage', maxRunsPerDay: 2, dailyCap: 100_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
    'pr-babysitter': { name: 'PR Babysitter', maxRunsPerDay: 288, dailyCap: 2_000_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
    'ci-sweeper': { name: 'CI Sweeper', maxRunsPerDay: 96, dailyCap: 1_000_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
    'dependency-sweeper': { name: 'Dependency Sweeper', maxRunsPerDay: 4, dailyCap: 500_000, maxSpawnsL1: 0, maxSpawnsL2: 3 },
    'post-merge-cleanup': { name: 'Post-Merge Cleanup', maxRunsPerDay: 1, dailyCap: 200_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
    'changelog-drafter': { name: 'Changelog Drafter', maxRunsPerDay: 1, dailyCap: 100_000, maxSpawnsL1: 0, maxSpawnsL2: 2 },
    'issue-triage': { name: 'Issue Triage', maxRunsPerDay: 12, dailyCap: 80_000, maxSpawnsL1: 0, maxSpawnsL2: 1 },
};
function parseArgs(argv) {
    let pattern = 'daily-triage';
    let tool = 'grok';
    let target = '.';
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--pattern' || a === '-p')
            pattern = argv[++i];
        else if (a === '--tool' || a === '-t')
            tool = argv[++i];
        else if (a === '--dry-run')
            dryRun = true;
        else if (a === '--help' || a === '-h')
            return { help: true, pattern, tool, target, dryRun };
        else if (!a.startsWith('-'))
            target = a;
    }
    return { help: false, pattern, tool, target, dryRun };
}
async function exists(p) {
    try {
        await access(p);
        return true;
    }
    catch {
        return false;
    }
}
async function copyDir(src, dest, dryRun) {
    if (!(await exists(src)))
        return false;
    if (dryRun) {
        console.log(`  would copy: ${src} → ${dest}`);
        return true;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true });
    console.log(`  copied: ${src} → ${dest}`);
    return true;
}
async function resolveBundledOrMonorepo(name) {
    const bundled = path.join(PACKAGE_ROOT, name);
    if (await exists(bundled))
        return bundled;
    return name === 'starters' ? MONOREPO_STARTERS : MONOREPO_TEMPLATES;
}
async function copyTemplateSkill(templatesRoot, templateFile, targetDir, tool, skillName, dryRun) {
    const src = path.join(templatesRoot, templateFile);
    const destByTool = {
        grok: path.join(targetDir, '.grok', 'skills', skillName, 'SKILL.md'),
        claude: path.join(targetDir, '.claude', 'skills', skillName, 'SKILL.md'),
        codex: path.join(targetDir, '.codex', 'skills', skillName, 'SKILL.md'),
    };
    const dest = destByTool[tool];
    if (await exists(dest))
        return;
    await copyFile(src, dest, dryRun);
}
async function copyTemplateVerifier(templatesRoot, targetDir, tool, dryRun) {
    const verifierPaths = {
        grok: path.join(targetDir, '.grok', 'skills', 'loop-verifier', 'SKILL.md'),
        claude: path.join(targetDir, '.claude', 'agents', 'loop-verifier.md'),
        codex: path.join(targetDir, '.codex', 'agents', 'verifier.toml'),
    };
    const dest = verifierPaths[tool];
    if (await exists(dest))
        return;
    if (tool === 'codex') {
        const src = path.join(templatesRoot, 'SKILL.md.verifier');
        const body = await readFile(src, 'utf8');
        const toml = `name = "loop-verifier"\ndescription = "Independent verification agent for loop-produced changes."\n\n[system_prompt]\ncontent = """\n${body}\n"""\n`;
        if (dryRun) {
            console.log(`  would write verifier: ${dest}`);
            return;
        }
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, toml);
        console.log(`  created: ${dest} (from verifier template)`);
        return;
    }
    const src = path.join(templatesRoot, 'SKILL.md.verifier');
    await copyFile(src, dest, dryRun);
}
async function copyL2Templates(pattern, tool, targetDir, templatesRoot, dryRun) {
    if (!PATTERNS_NEEDING_FIX.has(pattern) && !L2_PATTERNS.has(pattern))
        return;
    await copyTemplateSkill(templatesRoot, 'SKILL.md.minimal-fix', targetDir, tool, 'minimal-fix', dryRun);
    if (L2_PATTERNS.has(pattern) || pattern === 'dependency-sweeper') {
        await copyTemplateVerifier(templatesRoot, targetDir, tool, dryRun);
    }
}
function formatTokenCap(n) {
    if (n >= 1_000_000)
        return `${n / 1_000_000}M`;
    if (n >= 1_000)
        return `${n / 1_000}k`;
    return String(n);
}
function buildLoopBudgetMd(pattern) {
    const b = PATTERN_BUDGET[pattern];
    return `# Loop Budget — YOUR_PROJECT

> Primary loop: **${b.name}** (scaffolded by loop-init)

## Daily limits

| Loop | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|------|--------------|----------------|--------------------------|
| ${b.name} | ${b.maxRunsPerDay} | ${formatTokenCap(b.dailyCap)} | ${b.maxSpawnsL1} (L1) / ${b.maxSpawnsL2} (L2) |

## On budget exceed

1. Pause schedulers (\`scheduler_delete\` or disable automations)
2. Append event to \`loop-run-log.md\`
3. Notify human (Slack / issue / STATE.md High Priority)

## Kill switch

- Command or issue label: \`loop-pause-all\`
- Resume only after human clears the flag in STATE.md

## Estimate spend

\`\`\`bash
npx @cobusgreyling/loop-cost --pattern ${pattern}
\`\`\`
`;
}
async function scaffoldObservability(pattern, tool, targetDir, templatesRoot, dryRun) {
    const budgetPath = path.join(targetDir, 'loop-budget.md');
    const runLogTemplate = path.join(templatesRoot, 'loop-run-log.md.template');
    const runLogPath = path.join(targetDir, 'loop-run-log.md');
    if (!(await exists(budgetPath))) {
        const content = buildLoopBudgetMd(pattern);
        if (dryRun) {
            console.log(`  would write: ${budgetPath}`);
        }
        else {
            await writeFile(budgetPath, content);
            console.log(`  created: loop-budget.md`);
        }
    }
    if (!(await exists(runLogPath))) {
        await copyFile(runLogTemplate, runLogPath, dryRun);
    }
    await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-budget', targetDir, tool, 'loop-budget', dryRun);
}
async function scaffoldConstraints(targetDir, templatesRoot, tool, dryRun) {
    const constraintsPath = path.join(targetDir, 'loop-constraints.md');
    const constraintsTemplate = path.join(templatesRoot, 'loop-constraints.md');
    if (!(await exists(constraintsPath)) && (await exists(constraintsTemplate))) {
        await copyFile(constraintsTemplate, constraintsPath, dryRun);
    }
    await copyTemplateSkill(templatesRoot, 'SKILL.md.loop-constraints', targetDir, tool, 'loop-constraints', dryRun);
}
async function copyFile(src, dest, dryRun) {
    if (!(await exists(src)))
        return false;
    if (dryRun) {
        console.log(`  would copy: ${src} → ${dest}`);
        return true;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest);
    console.log(`  copied: ${src} → ${dest}`);
    return true;
}
function firstLoopCommand(pattern, tool) {
    const cmds = {
        'daily-triage': {
            grok: '/loop 1d Run loop-triage. Update STATE.md. No auto-fix in week one.',
            claude: '/loop 1d $loop-triage — update STATE.md. Report-only week one.',
            codex: 'Automation daily: $loop-triage → update STATE.md. Report-only.',
        },
        'pr-babysitter': {
            grok: '/loop 10m Run pr-review-triage. Update pr-babysitter-state.md. Worktree + minimal-fix + verifier for allowlisted PRs only. Escalate after 3 attempts.',
            claude: '/loop 10m $pr-review-triage — update pr-babysitter-state.md. No auto-merge.',
            codex: 'Automation 10m: pr-review-triage → pr-babysitter-state.md. No auto-merge.',
        },
        'ci-sweeper': {
            grok: '/loop 15m Run ci-triage on failing CI. Update ci-sweeper-state.md. Fix only regressions in worktree. Max 3 attempts.',
            claude: '/loop 15m $ci-triage — update ci-sweeper-state.md. Max 3 fix attempts.',
            codex: 'Automation 15m: ci-triage on CI failures. Max 3 attempts.',
        },
        'dependency-sweeper': {
            grok: '/loop 6h Run dependency-triage. Patch-only auto-fix in worktree + verifier. Escalate majors and denylist.',
            claude: '/loop 6h $dependency-triage — patch-only with verifier. Escalate risky bumps.',
            codex: 'Automation 6h: dependency-triage. Patch-only with verifier.',
        },
        'post-merge-cleanup': {
            grok: '/loop 1d Run post-merge-scan on recent merges. Update post-merge-state.md. Small fixes only in worktree.',
            claude: '/loop 1d $post-merge-scan — update post-merge-state.md. Small fixes only.',
            codex: 'Automation daily: post-merge-scan → post-merge-state.md.',
        },
        'changelog-drafter': {
            grok: '/loop 1d Run changelog-scan on merges since last tag. Produce categorized draft in RELEASE_NOTES_DRAFT.md using draft-release-notes. Update changelog-drafter-state.md. Human review only.',
            claude: '/loop 1d $changelog-scan + draft-release-notes — write RELEASE_NOTES_DRAFT.md and update state. Human approves before publish.',
            codex: 'Automation daily: changelog-scan + draft-release-notes → RELEASE_NOTES_DRAFT.md. Human review.',
        },
        'issue-triage': {
            grok: '/loop 2h Run issue-triage. Update issue-triage-state.md. Propose labels and priority only. No auto-apply. Human reviews the needs-human slice.',
            claude: '/loop 2h $issue-triage — update issue-triage-state.md. Suggest labels on allowlisted areas only. Report mode week one.',
            codex: 'Automation 2h: issue-triage → issue-triage-state.md. Propose only.',
        },
    };
    return cmds[pattern][tool];
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(`loop-init — scaffold loop engineering starters

Usage:
  loop-init [target-dir] --pattern <name> --tool <grok|claude|codex>

Patterns:
  daily-triage (default)
  pr-babysitter
  ci-sweeper
  dependency-sweeper
  post-merge-cleanup
  changelog-drafter (new low-risk release notes pattern)
  issue-triage (new low-risk issue queue health companion to daily triage)

Options:
  -p, --pattern   Pattern to scaffold
  -t, --tool      Tool target (default: grok)
  --dry-run       Print actions without copying
  -h, --help      This help

Examples:
  npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
  npx @cobusgreyling/loop-init . -p pr-babysitter -t claude
`);
        process.exit(0);
    }
    const { pattern, tool, target, dryRun } = args;
    const validPatterns = Object.keys(PATTERN_STARTERS);
    const validTools = Object.keys(TOOL_SUFFIX);
    if (!validPatterns.includes(pattern)) {
        console.error(`Unknown pattern: ${pattern}. Valid: ${validPatterns.join(', ')}`);
        process.exit(1);
    }
    if (!validTools.includes(tool)) {
        console.error(`Unknown tool: ${tool}. Valid: ${validTools.join(', ')}`);
        process.exit(1);
    }
    const targetDir = path.resolve(target);
    const baseStarter = PATTERN_STARTERS[pattern];
    const suffix = TOOL_SUFFIX[tool];
    const starterName = pattern === 'daily-triage' ? `minimal-loop${suffix}` : baseStarter;
    const startersRoot = await resolveBundledOrMonorepo('starters');
    const templatesRoot = await resolveBundledOrMonorepo('templates');
    const starterRoot = path.join(startersRoot, starterName);
    if (!(await exists(starterRoot))) {
        const fallback = path.join(startersRoot, baseStarter);
        if (!(await exists(fallback))) {
            console.error(`Starter not found: ${starterRoot}`);
            process.exit(1);
        }
        console.log(`Note: no ${tool} variant for ${pattern} — using ${baseStarter} (Grok paths)`);
    }
    const effectiveStarter = (await exists(starterRoot))
        ? starterRoot
        : path.join(startersRoot, baseStarter);
    console.log(`\nloop-init: ${pattern} → ${targetDir} (${tool})${dryRun ? ' [dry-run]' : ''}\n`);
    const skillRoots = [
        path.join(effectiveStarter, '.grok', 'skills'),
        path.join(effectiveStarter, '.claude', 'skills'),
        path.join(effectiveStarter, '.codex', 'skills'),
    ];
    for (const skillsDir of skillRoots) {
        if (!(await exists(skillsDir)))
            continue;
        const toolPrefix = skillsDir.includes('.grok')
            ? '.grok/skills'
            : skillsDir.includes('.claude')
                ? '.claude/skills'
                : '.codex/skills';
        const entries = await readDirNames(skillsDir);
        for (const entry of entries) {
            await copyDir(path.join(skillsDir, entry), path.join(targetDir, toolPrefix, entry), dryRun);
        }
    }
    const agentFiles = [
        { src: path.join(effectiveStarter, '.claude', 'agents'), dest: path.join(targetDir, '.claude', 'agents') },
        { src: path.join(effectiveStarter, '.codex', 'agents'), dest: path.join(targetDir, '.codex', 'agents') },
    ];
    for (const { src, dest } of agentFiles) {
        if (await exists(src)) {
            const entries = await readDirNames(src);
            for (const entry of entries) {
                await copyFile(path.join(src, entry), path.join(dest, entry), dryRun);
            }
        }
    }
    const stateFile = STATE_FILES[pattern];
    const stateExample = path.join(effectiveStarter, `${stateFile}.example`);
    if (await exists(stateExample)) {
        await copyFile(stateExample, path.join(targetDir, stateFile), dryRun);
    }
    else {
        const alt = path.join(effectiveStarter, 'STATE.md.example');
        if (await exists(alt)) {
            await copyFile(alt, path.join(targetDir, stateFile), dryRun);
        }
    }
    const loopMd = path.join(effectiveStarter, 'LOOP.md');
    if (await exists(loopMd)) {
        await copyFile(loopMd, path.join(targetDir, 'LOOP.md'), dryRun);
    }
    await copyL2Templates(pattern, tool, targetDir, templatesRoot, dryRun);
    await scaffoldObservability(pattern, tool, targetDir, templatesRoot, dryRun);
    await scaffoldConstraints(targetDir, templatesRoot, tool, dryRun);
    if (!dryRun && !(await exists(path.join(targetDir, 'AGENTS.md')))) {
        const agentsTemplate = `# AGENTS.md

## Test commands
npm test
npm run lint

## Loop conventions
- Report-only week one (L1) before enabling auto-fix (L2)
- See LOOP.md for cadence and human gates
`;
        await writeFile(path.join(targetDir, 'AGENTS.md'), agentsTemplate);
        console.log('  created: AGENTS.md (template)');
    }
    console.log('\n=== Next steps ===');
    console.log(`  npx @cobusgreyling/loop-audit ${target === '.' ? '.' : target} --suggest`);
    console.log(`  npx @cobusgreyling/loop-cost --pattern ${pattern}`);
    console.log(`  First loop command (${tool}):\n  ${firstLoopCommand(pattern, tool)}\n`);
}
async function readDirNames(dir) {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() || e.isFile()).map((e) => e.name);
}
main().catch((err) => {
    console.error('loop-init failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
