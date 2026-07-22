import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const VALID_BUDGET_SCENARIOS = ['realistic', 'action', 'report', 'caching'];
export function assertValidBudgetScenario(scenario) {
    if (!VALID_BUDGET_SCENARIOS.includes(scenario)) {
        throw new Error(`Invalid --budget-scenario: ${scenario}. Valid: ${VALID_BUDGET_SCENARIOS.join(', ')}`);
    }
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
/** Locate loop-cost's built CLI: monorepo sibling first, then an installed dependency. */
export async function resolveCostCli() {
    const monorepo = path.resolve(PACKAGE_ROOT, '../loop-cost/dist/cli.js');
    if (await exists(monorepo))
        return monorepo;
    try {
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        const pkg = require.resolve('@cobusgreyling/loop-cost/package.json');
        return path.join(path.dirname(pkg), 'dist/cli.js');
    }
    catch {
        return null;
    }
}
function runCostCli(cli, args) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [cli, ...args, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
        child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
        child.on('error', reject);
        child.on('close', (code) => resolve({ stdout, stderr, code }));
    });
}
/**
 * Shell out to loop-cost's built CLI (same monorepo-then-installed-dependency
 * resolution loop-init uses for loop-audit) and parse its --json estimate.
 * Shared by both the per-run and daily budget resolvers below.
 */
async function invokeLoopCost(input) {
    const cli = await resolveCostCli();
    if (!cli) {
        throw new Error('Resolving a budget from a pattern requires @cobusgreyling/loop-cost. Install it, or run from the loop-engineering monorepo.');
    }
    const args = ['--pattern', input.pattern, '--level', input.level ?? 'L1'];
    if (input.cadence)
        args.push('--cadence', input.cadence);
    if (input.conservative)
        args.push('--conservative');
    if (input.scenario === 'caching')
        args.push('--with-caching');
    const { stdout, stderr, code } = await runCostCli(cli, args);
    if (code !== 0) {
        throw new Error(stderr.trim() || `loop-cost exited with code ${code}.`);
    }
    if (!stdout.trim()) {
        throw new Error('loop-cost produced no output.');
    }
    try {
        return JSON.parse(stdout);
    }
    catch {
        throw new Error('loop-cost produced output that could not be parsed as JSON.');
    }
}
/**
 * Resolve a token budget from loop-cost's realistic per-pattern estimate
 * instead of a hand-typed number.
 */
export async function resolveTokenBudgetFromPattern(input) {
    const scenario = input.scenario ?? 'realistic';
    assertValidBudgetScenario(scenario);
    const parsed = await invokeLoopCost(input);
    const tokensPerRun = parsed.scenarios?.[scenario]?.tokensPerRun;
    if (typeof tokensPerRun !== 'number') {
        const hint = scenario === 'caching'
            ? ' This pattern may be missing stable_fraction in registry.yaml.'
            : '';
        throw new Error(`loop-cost output missing scenarios.${scenario}.tokensPerRun.${hint}`);
    }
    return tokensPerRun;
}
/**
 * Resolve a pattern's suggested daily token cap from loop-cost, for
 * cross-run daily spend tracking (see daily-spend.ts).
 */
export async function resolveDailyBudgetFromPattern(input) {
    const parsed = await invokeLoopCost(input);
    const dailyCap = parsed.suggestedDailyCap;
    if (typeof dailyCap !== 'number') {
        throw new Error('loop-cost output missing suggestedDailyCap.');
    }
    return dailyCap;
}
