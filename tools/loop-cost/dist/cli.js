#!/usr/bin/env node
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { assertValidLevel, estimateCost, formatEstimateHuman, parseOrchestration, } from './estimator.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
function parseArgs(argv) {
    let pattern = 'daily-triage';
    let cadence;
    let level = 'L1';
    let conservative = false;
    let json = false;
    let list = false;
    let orchestration = 'single';
    let withCaching = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--pattern' || a === '-p')
            pattern = argv[++i];
        else if (a === '--cadence' || a === '-c')
            cadence = argv[++i];
        else if (a === '--level' || a === '-l')
            level = argv[++i];
        else if (a === '--orchestration' || a === '-o')
            orchestration = argv[++i];
        else if (a === '--conservative')
            conservative = true;
        else if (a === '--json')
            json = true;
        else if (a === '--list')
            list = true;
        else if (a === '--with-caching')
            withCaching = true;
        else if (a === '--help' || a === '-h')
            return { help: true };
    }
    return { help: false, pattern, cadence, level, conservative, json, list, orchestration, withCaching };
}
async function loadRegistry() {
    const candidates = [
        path.join(PACKAGE_ROOT, 'registry.json'),
        path.resolve(PACKAGE_ROOT, '../../patterns/registry.yaml'),
    ];
    for (const p of candidates) {
        try {
            await access(p);
            const raw = await readFile(p, 'utf8');
            if (p.endsWith('.json'))
                return JSON.parse(raw);
            return yaml.parse(raw);
        }
        catch {
            /* try next */
        }
    }
    throw new Error('Pattern registry not found. Run from loop-engineering repo or install @cobusgreyling/loop-cost.');
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(`loop-cost — estimate daily token spend for loop patterns

Usage:
  loop-cost --pattern <id> [options]

Options:
  -p, --pattern <id>     Pattern id (default: daily-triage)
  -c, --cadence <spec>   Override cadence (e.g. 15m, 1d, 5m-15m)
  -l, --level <L1|L2|L3> Readiness level (default: L1)
  -o, --orchestration <mode>
                         Multi-agent action cost: single (default),
                         maker-checker, parallel:N, debate:R
  --conservative         Use slower cadence from ranges (e.g. 15m not 5m)
  --with-caching         Show estimate with prompt caching applied
                         (requires stable_fraction in the pattern's cost block)
  --json                 Machine-readable output
  --list                 List pattern ids
  -h, --help             This help

Examples:
  loop-cost --pattern ci-sweeper --cadence 15m --level L2
  loop-cost --pattern ci-sweeper --level L2 --orchestration maker-checker
  loop-cost --pattern daily-triage --level L1 --json
  loop-cost --list
`);
        process.exit(0);
    }
    const registry = await loadRegistry();
    if (args.list) {
        for (const p of registry.patterns) {
            console.log(`${p.id}\t${p.token_cost}\t${p.cadence}`);
        }
        return;
    }
    const pattern = registry.patterns.find((p) => p.id === args.pattern);
    if (!pattern) {
        console.error(`Unknown pattern: ${args.pattern}. Use --list for ids.`);
        process.exit(1);
    }
    try {
        assertValidLevel(args.level);
        parseOrchestration(args.orchestration);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(msg);
        process.exit(1);
    }
    if (!pattern.cost) {
        console.error(`Pattern ${args.pattern} has no cost block in registry.`);
        process.exit(1);
    }
    const result = estimateCost({
        pattern,
        cadence: args.cadence,
        level: args.level,
        conservative: args.conservative,
        orchestration: args.orchestration,
        withCaching: args.withCaching,
    });
    if (args.json)
        console.log(JSON.stringify(result, null, 2));
    else
        console.log(formatEstimateHuman(result));
}
main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('loop-cost failed:', msg);
    process.exit(1);
});
