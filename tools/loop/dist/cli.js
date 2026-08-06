#!/usr/bin/env node
/**
 * @cobusgreyling/loop — unified front door for Loop Engineering CLIs.
 * Additive: loop-init, loop-audit, and siblings stay fully supported.
 */
import { runTool } from './pass-through.js';
import { runDoctor, formatDoctorHuman } from './doctor.js';
import { runStatus, formatStatusHuman } from './status.js';
import { defaultPlan, executePlan, printNonInteractiveHelp, resolvePattern, resolveTool, runInteractiveWizard, } from './wizard.js';
const VERSION = '0.1.2';
const PASS_THROUGH = new Set([
    'init',
    'audit',
    'cost',
    'sync',
    'context',
    'worktree',
    'gate',
    'mcp',
    'sandbox',
]);
function printHelp() {
    console.log(`loop — Loop Engineering unified CLI v${VERSION}

Usage:
  loop                          Week-one help (or wizard if TTY + --interactive)
  loop init [args…]             → loop-init (scaffold)
  loop audit [args…]            → loop-audit (Loop Ready score)
  loop cost [args…]             → loop-cost
  loop sync [args…]             → loop-sync
  loop doctor [path] [--json]   Audit + sync + files → top 3 actions
  loop status [path] [--json]   Day-2 dashboard from STATE / run-log
  loop badge [path]             README badge (→ loop-audit --badge)
  loop wizard [--yes]           Guided scaffold + doctor
  loop context|worktree|gate|mcp|sandbox [args…]

Evidence-aware PR promotion:
  loop gate promote --contract promotion.yaml --evidence pr-42.json --json

Week-one (recommended):
  npx @cobusgreyling/loop init . --pattern daily-triage --tool grok
  npx @cobusgreyling/loop doctor .

Doctor exit codes:
  0  healthy
  1  warnings (score/sync/budget gaps)
  2  blocked (score < 40, critical drift, or unscaffolded)

Compatibility (old doors stay open):
  npx @cobusgreyling/loop-init .
  npx @cobusgreyling/loop-audit . --suggest

Docs: https://github.com/cobusgreyling/loop-engineering/blob/main/docs/QUICKSTART.md
Showcase: https://cobusgreyling.github.io/loop-engineering/
`);
}
async function cmdDoctor(args) {
    const json = args.includes('--json');
    const target = args.find((a) => !a.startsWith('-')) || '.';
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`loop doctor [path] [--json]

Combines loop-audit + loop-sync + structural file checks.
Prints severity and the top 3 next actions.

Exit: 0 healthy · 1 warning · 2 blocked
`);
        return 0;
    }
    const report = await runDoctor(target);
    if (json)
        console.log(JSON.stringify(report, null, 2));
    else
        console.log(formatDoctorHuman(report));
    return report.exitCode;
}
async function cmdStatus(args) {
    const json = args.includes('--json');
    const target = args.find((a) => !a.startsWith('-')) || '.';
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`loop status [path] [--json]

Shows pattern, Loop Ready score, last runs from loop-run-log.md, ledger, budget.
`);
        return 0;
    }
    const report = await runStatus(target);
    if (json)
        console.log(JSON.stringify(report, null, 2));
    else
        console.log(formatStatusHuman(report));
    return 0;
}
async function cmdBadge(args) {
    const target = args.find((a) => !a.startsWith('-')) || '.';
    return runTool('audit', [target, '--badge']);
}
async function cmdWizard(args) {
    const yes = args.includes('--yes') || args.includes('-y');
    const interactive = args.includes('--interactive') || args.includes('-i');
    // Allow: loop wizard -p daily-triage -t claude .
    let plan = defaultPlan();
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--pattern' || a === '-p')
            plan.pattern = resolvePattern(args[++i] ?? '');
        else if (a === '--tool' || a === '-t')
            plan.tool = resolveTool(args[++i] ?? '');
        else if (a === '--with-foundry')
            plan.withFoundry = true;
        else if (a === '--yes' || a === '-y' || a === '--interactive' || a === '-i')
            continue;
        else if (!a.startsWith('-'))
            plan.target = a;
    }
    if (interactive && process.stdin.isTTY) {
        plan = await runInteractiveWizard();
        return executePlan(plan);
    }
    if (yes || args.some((a) => a === '--pattern' || a === '-p')) {
        return executePlan(plan);
    }
    printNonInteractiveHelp();
    return 0;
}
async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        if (process.stdin.isTTY && argv.includes('--interactive')) {
            // unreachable when length 0 — handled below
        }
        printNonInteractiveHelp();
        return;
    }
    const [cmd, ...rest] = argv;
    if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
        printHelp();
        return;
    }
    if (cmd === '--version' || cmd === '-V' || cmd === 'version') {
        console.log(VERSION);
        return;
    }
    if (cmd === '--interactive' || cmd === '-i') {
        const plan = await runInteractiveWizard();
        process.exitCode = await executePlan(plan);
        return;
    }
    if (PASS_THROUGH.has(cmd)) {
        const code = await runTool(cmd, rest);
        process.exitCode = code;
        return;
    }
    if (cmd === 'doctor') {
        process.exitCode = await cmdDoctor(rest);
        return;
    }
    if (cmd === 'status') {
        process.exitCode = await cmdStatus(rest);
        return;
    }
    if (cmd === 'badge') {
        process.exitCode = await cmdBadge(rest);
        return;
    }
    if (cmd === 'wizard') {
        process.exitCode = await cmdWizard(rest);
        return;
    }
    // Unknown: if it looks like a path or init flags, hint; else help
    console.error(`Unknown command: ${cmd}\n`);
    printHelp();
    process.exitCode = 1;
}
main().catch((err) => {
    console.error('loop failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
