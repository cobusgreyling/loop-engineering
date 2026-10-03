#!/usr/bin/env node
/**
 * loop-drill CLI.
 *
 * Exit codes follow loop-gate / loop-context so control scripts can chain all
 * three: 0 proceed, 1 warnings, 2 escalate.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadGateConfig } from '@cobusgreyling/loop-gate';
import { DEFAULT_BREAKER } from '@cobusgreyling/loop-context';
import { buildReport, exitCodeFor, runBreakerDrills, runGateDrills, skip, } from './drill.js';
import { runCanary } from './canary.js';
import { formatReport } from './report.js';
import { buildGroups, fingerprint, RECORD_FILE, writeRecord } from './record.js';
const HELP = `loop-drill — fire drills for loop guardrails

Injects a known fault and asserts the guardrail actually fires. Turns L3
readiness from "the files exist" into "the guardrails demonstrably work".

Usage: loop-drill [path] [options]

Options:
  --only <drills>        Comma-separated: gate, breaker, verifier (default: gate,breaker)
  --verifier-cmd <cmd>   Verifier command to drill. Non-zero exit = rejected.
                         Required to run the verifier canary.
  --mutants <n>          Seeded defects for the canary (default: 3)
  --scope <path>         Restrict mutation to this repo-relative path
  --setup <cmd>          Command run in each worktree before verifying
                         (e.g. "npm ci") — a fresh worktree has no node_modules
  --timeout <ms>         Per-verifier-run timeout (default: 120000)
  --gate-file <path>     Policy file (default: gate.yaml)
  --benign-path <path>   Path the gate specificity drill treats as ordinary
                         (default: docs/README.md)
  --token-budget <n>     Token budget for the breaker drill
  --record               Write the results to loop-drill.json, which loop-audit
                         reads as proof the guardrails fire. Replaces only the
                         guardrails drilled this run; commit the file
  --json                 Machine-readable output
  --help, -h             Show this message

Exit codes: 0 all drills passed, 1 some skipped, 2 a guardrail failed to fire.

Examples:
  loop-drill .
  loop-drill . --only verifier --verifier-cmd "npm test" --setup "npm ci"
  loop-drill . --only gate,breaker --json
  loop-drill . --record
`;
function parseArgs(argv) {
    const flags = { root: '.', json: false, help: false, mutants: 3, timeoutMs: 120_000, record: false };
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            const v = argv[++i];
            if (v === undefined)
                throw new Error(`${arg} requires a value`);
            return v;
        };
        switch (arg) {
            case '--help':
            case '-h':
                flags.help = true;
                break;
            case '--json':
                flags.json = true;
                break;
            case '--record':
                flags.record = true;
                break;
            case '--only':
                flags.only = next();
                break;
            case '--verifier-cmd':
                flags.verifierCmd = next();
                break;
            case '--mutants':
                flags.mutants = parsePositiveInt(next(), '--mutants');
                break;
            case '--scope':
                flags.scope = next();
                break;
            case '--setup':
                flags.setup = next();
                break;
            case '--timeout':
                flags.timeoutMs = parsePositiveInt(next(), '--timeout');
                break;
            case '--gate-file':
                flags.gateFile = next();
                break;
            case '--benign-path':
                flags.benignPath = next();
                break;
            case '--token-budget':
                flags.tokenBudget = parsePositiveInt(next(), '--token-budget');
                break;
            default:
                if (arg.startsWith('-'))
                    throw new Error(`Unknown option: ${arg}`);
                positional.push(arg);
        }
    }
    if (positional.length > 0)
        flags.root = positional[0];
    return flags;
}
function parsePositiveInt(value, flag) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0)
        throw new Error(`${flag} expects a positive integer, got: ${value}`);
    return n;
}
async function main() {
    let flags;
    try {
        flags = parseArgs(process.argv.slice(2));
    }
    catch (err) {
        console.error(`${err.message}\n`);
        console.error(HELP);
        process.exit(2);
    }
    if (flags.help) {
        console.log(HELP);
        return;
    }
    const root = path.resolve(flags.root);
    const selected = new Set((flags.only ?? 'gate,breaker').split(',').map((s) => s.trim()).filter(Boolean));
    const results = [];
    let mutationScore = null;
    const gateFile = path.resolve(root, flags.gateFile ?? 'gate.yaml');
    if (selected.has('gate')) {
        try {
            const config = await loadGateConfig(gateFile);
            results.push(...runGateDrills({ config, benignPath: flags.benignPath }));
        }
        catch (err) {
            results.push(skip('gate', 'gate drills', 'Over-Reach (Wrong Scope)', 'sensitivity', `${err.message} Nothing mechanically stops a loop from editing a sensitive path.`));
        }
    }
    if (selected.has('breaker')) {
        const config = flags.tokenBudget === undefined
            ? DEFAULT_BREAKER
            : { ...DEFAULT_BREAKER, tokenBudget: flags.tokenBudget };
        results.push(...runBreakerDrills(config));
    }
    if (selected.has('verifier')) {
        if (!flags.verifierCmd) {
            results.push(skip('verifier', 'verifier canary', 'Verifier Theater', 'sensitivity', 'No --verifier-cmd given. loop-audit scores a verifier by filename alone; without a command to run, this drill cannot tell a real verifier from an empty file.'));
        }
        else {
            const canary = await runCanary({
                root,
                command: flags.verifierCmd,
                count: flags.mutants,
                timeoutMs: flags.timeoutMs,
                scope: flags.scope,
                setup: flags.setup,
            });
            results.push(...canary.results);
            mutationScore = canary.mutationScore;
        }
    }
    if (results.length === 0) {
        console.error(`No drills selected. --only accepts: gate, breaker, verifier\n`);
        process.exit(2);
    }
    const report = buildReport(results);
    const code = exitCodeFor(report);
    if (flags.json) {
        console.log(JSON.stringify({ ...report, mutationScore, exitCode: code }, null, 2));
    }
    else {
        console.log(formatReport(report, mutationScore));
    }
    if (flags.record) {
        // Failures are recorded too: loop-audit withdraws credit for a guardrail
        // that was shown not to fire.
        const gateText = await readFile(gateFile, 'utf8').catch(() => null);
        const groups = buildGroups(results, selected, {
            recordedAt: report.timestamp,
            gateFile: path.relative(root, gateFile).split(path.sep).join('/'),
            gateSha256: gateText === null ? null : fingerprint(gateText),
            verifierCommand: flags.verifierCmd,
            mutationScore,
        });
        await writeRecord(root, groups);
        const note = `Recorded ${Object.keys(groups).join(', ')} to ${RECORD_FILE} — commit it so loop-audit can see the proof.`;
        if (flags.json)
            console.error(note);
        else
            console.log(note);
    }
    process.exit(code);
}
main().catch((err) => {
    console.error(`loop-drill failed: ${err.message}`);
    process.exit(2);
});
