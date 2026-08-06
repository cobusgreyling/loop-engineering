#!/usr/bin/env node
import { checkGate, loadGateConfig, assertValidAction, } from './gate.js';
import { evaluatePromotion, loadPromotionContract, loadPromotionEvidence, } from './promotion.js';
import { evaluateRepair, loadRepairContract, loadRepairEvidence, } from './repair.js';
function parseFlags(argv) {
    const flags = { help: false, gateFile: 'gate.yaml', json: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h')
            flags.help = true;
        else if (a === '--action')
            flags.action = argv[++i];
        else if (a === '--paths')
            flags.paths = argv[++i];
        else if (a === '--gate-file')
            flags.gateFile = argv[++i];
        else if (a === '--contract')
            flags.contractFile = argv[++i];
        else if (a === '--evidence')
            flags.evidenceFile = argv[++i];
        else if (a === '--json')
            flags.json = true;
    }
    return flags;
}
const HELP = `loop-gate — mechanical safety and evidence-aware PR promotion gates

Evaluates a proposed change (action type + changed paths) against
gate.yaml's denylist, max-files, and auto-merge allowlist. No knowledge of
run history — pair with loop-context --check for stagnation/budget triggers.

Usage:
  loop-gate check --action <commit|merge|auto-merge> --paths <f1,f2,...> [options]
  loop-gate promote --contract <promotion.yaml> --evidence <evidence.json> [options]
  loop-gate repair-plan --contract <repair.yaml> --evidence <evidence.json> [options]

Options:
  --action <commit|merge|auto-merge>   What the loop is about to do
  --paths <f1,f2,...>                  Comma-separated changed file paths
  --gate-file <path>                   Policy file (default: gate.yaml)
  --contract <path>                    Promotion contract YAML
  --evidence <path>                    Observed PR evidence JSON
  --json                               Machine-readable output
  -h, --help                           This help

Exit codes: 0 allowed · 2 escalate · 1 error

Example:
  loop-gate check --action auto-merge --paths $(git diff --name-only | tr '\\n' ',')
  loop-gate promote --contract promotion.yaml --evidence pr-42.json --json
  loop-gate repair-plan --contract repair.yaml --evidence queue.json --json
`;
async function main() {
    const argv = process.argv.slice(2);
    const command = argv[0];
    if (!command || command === '--help' || command === '-h') {
        console.log(HELP);
        return command ? 0 : 1;
    }
    if (command !== 'check' && command !== 'promote' && command !== 'repair-plan') {
        console.error(`Unknown command "${command}".\n\n${HELP}`);
        return 1;
    }
    const flags = parseFlags(argv.slice(1));
    if (flags.help) {
        console.log(HELP);
        return 0;
    }
    if (command === 'promote') {
        if (!flags.contractFile || !flags.evidenceFile) {
            throw new Error('promote requires --contract and --evidence.');
        }
        const [contract, evidence, gate] = await Promise.all([
            loadPromotionContract(flags.contractFile),
            loadPromotionEvidence(flags.evidenceFile),
            loadGateConfig(flags.gateFile),
        ]);
        const decision = evaluatePromotion(contract, evidence, gate);
        if (flags.json) {
            console.log(JSON.stringify(decision, null, 2));
        }
        else {
            console.log(`${decision.allowed ? 'MERGE-READY' : 'HOLD'} [${decision.stage}] — ${decision.summary}`);
            for (const item of decision.issues) {
                console.log(`  - ${item.kind} ${item.code}: ${item.message}`);
            }
        }
        return decision.allowed ? 0 : 2;
    }
    if (command === 'repair-plan') {
        if (!flags.contractFile || !flags.evidenceFile) {
            throw new Error('repair-plan requires --contract and --evidence.');
        }
        const [contract, evidence] = await Promise.all([
            loadRepairContract(flags.contractFile),
            loadRepairEvidence(flags.evidenceFile),
        ]);
        const decision = evaluateRepair(contract, evidence);
        if (flags.json) {
            console.log(JSON.stringify(decision, null, 2));
        }
        else {
            console.log(`${decision.state.toUpperCase()} — ${decision.summary}`);
            if (decision.selected) {
                console.log(`  - ${decision.selected.action} ${decision.selected.type} #${decision.selected.number} (${decision.selected.mode})`);
            }
            for (const item of decision.issues) {
                console.log(`  - ${item.kind} ${item.code}: ${item.message}`);
            }
        }
        return decision.state === 'selected' || decision.state === 'idle' ? 0 : 2;
    }
    if (!flags.action || !flags.paths) {
        throw new Error('check requires --action and --paths.');
    }
    assertValidAction(flags.action);
    const config = await loadGateConfig(flags.gateFile);
    const paths = flags.paths.split(',').map((p) => p.trim()).filter(Boolean);
    if (paths.length === 0) {
        throw new Error('--paths must contain at least one non-empty path.');
    }
    const decision = checkGate({ config, action: flags.action, paths });
    if (flags.json) {
        console.log(JSON.stringify(decision, null, 2));
    }
    else {
        console.log(`${decision.allowed ? 'ALLOWED' : 'ESCALATE'} [${decision.trigger}] — ${decision.reason}`);
    }
    return decision.allowed ? 0 : 2;
}
main()
    .then((code) => process.exit(code))
    .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
