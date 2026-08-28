/**
 * Non-interactive week-one wizard when `loop` is run with no args
 * (or `loop wizard`). Interactive prompts only when TTY + --interactive.
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { runTool } from './pass-through.js';
import { runDoctor, formatDoctorHuman } from './doctor.js';
export const PAIN_OPTIONS = [
    { id: '1', label: 'Morning chaos — what should I do?', pattern: 'daily-triage' },
    { id: '2', label: 'PRs stalling on review/CI', pattern: 'pr-babysitter' },
    { id: '3', label: 'CI red / flaky checks', pattern: 'ci-sweeper' },
    { id: '4', label: 'Dependabot / CVE noise', pattern: 'dependency-sweeper' },
    { id: '5', label: 'Merge debt / TODOs piling up', pattern: 'post-merge-cleanup' },
    { id: '6', label: 'Stale release notes / changelogs', pattern: 'changelog-drafter' },
    { id: '7', label: 'Noisy issue backlog / duplicates', pattern: 'issue-triage' },
    { id: '8', label: 'Just a GitHub Action, no extra files', pattern: 'thin-loop' },
];
export const TOOLS = ['grok', 'claude', 'codex', 'opencode'];
export function defaultPlan() {
    return {
        pattern: 'daily-triage',
        tool: 'claude',
        target: '.',
        withFoundry: false,
    };
}
export function formatWizardBanner() {
    return `
Loop Engineering — week-one wizard
══════════════════════════════════════════════════
Front door for init · audit · cost · doctor · status
Existing packages (loop-init, loop-audit, …) stay supported.

Not sure which loop? Start with daily-triage (report-only).
Interactive picker: https://cobusgreyling.github.io/loop-engineering/#interactive
`;
}
export function formatPainMenu() {
    const lines = ['What is hurting right now?', ''];
    for (const p of PAIN_OPTIONS) {
        lines.push(`  ${p.id}) ${p.label}  →  ${p.pattern}`);
    }
    lines.push('');
    lines.push('  Enter 1-8, or pattern id (default: daily-triage)');
    return lines.join('\n');
}
export function resolvePattern(answer) {
    const t = answer.trim().toLowerCase();
    if (!t)
        return 'daily-triage';
    const byId = PAIN_OPTIONS.find((p) => p.id === t);
    if (byId)
        return byId.pattern;
    const byPattern = PAIN_OPTIONS.find((p) => p.pattern === t);
    if (byPattern)
        return byPattern.pattern;
    // free-form pattern id
    if (/^[a-z0-9-]+$/.test(t))
        return t;
    return 'daily-triage';
}
export function resolveTool(answer) {
    const t = answer.trim().toLowerCase();
    if (TOOLS.includes(t))
        return t;
    return 'claude';
}
export async function runInteractiveWizard() {
    const rl = readline.createInterface({ input, output });
    try {
        console.log(formatWizardBanner());
        console.log(formatPainMenu());
        const pain = await rl.question('> ');
        const pattern = resolvePattern(pain);
        console.log(`\nCoding agent tool? (${TOOLS.join(' / ')}) [claude]`);
        const toolAns = await rl.question('> ');
        const tool = resolveTool(toolAns);
        console.log('\nTarget directory? [.]');
        const targetAns = await rl.question('> ');
        const target = targetAns.trim() || '.';
        return { pattern, tool, target, withFoundry: false };
    }
    finally {
        rl.close();
    }
}
export function printNonInteractiveHelp() {
    console.log(formatWizardBanner());
    console.log(`Week-one path (copy/paste):

  npx @cobusgreyling/loop init . --pattern daily-triage --tool claude
  npx @cobusgreyling/loop doctor .

Or pick a pain point, then scaffold:

${PAIN_OPTIONS.map((p) => `  ${p.id}. ${p.label}\n     npx @cobusgreyling/loop init . -p ${p.pattern} -t claude`).join('\n\n')}

Commands:
  loop init|audit|cost|sync|doctor|status|badge|wizard
  loop context|worktree|gate|mcp|sandbox   (pass-through)

  loop doctor . --json
  loop status .
  loop --help

Same as before (still fully supported):
  npx @cobusgreyling/loop-init .
  npx @cobusgreyling/loop-audit . --suggest
`);
}
/** Run init with plan, then doctor. */
export async function executePlan(plan) {
    const initArgs = [plan.target, '--pattern', plan.pattern, '--tool', plan.tool];
    if (plan.withFoundry)
        initArgs.push('--with-foundry');
    console.log(`\n→ loop init ${initArgs.join(' ')}\n`);
    const code = await runTool('init', initArgs);
    if (code !== 0)
        return code;
    console.log('\n→ loop doctor\n');
    const report = await runDoctor(plan.target);
    console.log(formatDoctorHuman(report));
    return report.exitCode;
}
