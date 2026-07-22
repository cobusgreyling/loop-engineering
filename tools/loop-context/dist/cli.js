#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { buildContextInjection, checkCircuitBreaker, pruneLedger, summarizeAttempts, DEFAULT_BREAKER, DEFAULT_PRUNE, } from './context-manager.js';
import { resolveTokenBudgetFromPattern, resolveDailyBudgetFromPattern, } from './budget-resolver.js';
import { recordDailySpend } from './daily-spend.js';
/** Reject NaN/0/floats so a bad flag cannot silently disable the breaker. */
function parsePositiveIntFlag(raw, flag) {
    if (raw === undefined || raw === '') {
        throw new Error(`${flag} requires a positive integer value.`);
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
        throw new Error(`${flag} must be a positive integer; got "${raw}".`);
    }
    return n;
}
function parsePositiveFloatFlag(raw, flag) {
    if (raw === undefined || raw === '') {
        throw new Error(`${flag} requires a positive number value.`);
    }
    const n = Number(raw);
    if (Number.isNaN(n) || n <= 0) {
        throw new Error(`${flag} must be a positive number; got "${raw}".`);
    }
    return n;
}
function parseArgs(argv) {
    const breaker = { ...DEFAULT_BREAKER };
    const prune = { ...DEFAULT_PRUNE };
    let op = 'status';
    let ledger;
    let json = false;
    let budgetFromPattern;
    let budgetLevel = 'L1';
    let budgetScenario = 'realistic';
    let budgetCadence;
    let budgetConservative = false;
    let dailyBudgetFromPattern;
    let dailyStateDir = '.loop-context';
    let onExceed;
    const base = () => ({
        op, json, breaker, prune,
        budgetFromPattern, budgetLevel, budgetScenario, budgetCadence, budgetConservative,
        dailyBudgetFromPattern, dailyStateDir, onExceed,
    });
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h')
            return { help: true, ...base() };
        else if (a === '--ledger' || a === '-f')
            ledger = argv[++i];
        else if (a === '--check')
            op = 'check';
        else if (a === '--prune')
            op = 'prune';
        else if (a === '--inject')
            op = 'inject';
        else if (a === '--summary')
            op = 'summary';
        else if (a === '--status')
            op = 'status';
        else if (a === '--json')
            json = true;
        else if (a === '--max-iterations')
            breaker.maxIterations = parsePositiveIntFlag(argv[++i], '--max-iterations');
        else if (a === '--stagnation')
            breaker.stagnationThreshold = parsePositiveIntFlag(argv[++i], '--stagnation');
        else if (a === '--no-progress')
            breaker.noProgressThreshold = parsePositiveIntFlag(argv[++i], '--no-progress');
        else if (a === '--token-budget')
            breaker.tokenBudget = parsePositiveIntFlag(argv[++i], '--token-budget');
        else if (a === '--budget-from-pattern')
            budgetFromPattern = argv[++i];
        else if (a === '--budget-level')
            budgetLevel = argv[++i];
        else if (a === '--budget-scenario')
            budgetScenario = argv[++i];
        else if (a === '--budget-cadence')
            budgetCadence = argv[++i];
        else if (a === '--budget-conservative')
            budgetConservative = true;
        else if (a === '--daily-budget-from-pattern')
            dailyBudgetFromPattern = argv[++i];
        else if (a === '--daily-state-dir')
            dailyStateDir = argv[++i];
        else if (a === '--on-exceed')
            onExceed = argv[++i];
        else if (a === '--window')
            prune.window = parsePositiveIntFlag(argv[++i], '--window');
        else if (a === '--max-trace-lines')
            prune.maxTraceLines = parsePositiveIntFlag(argv[++i], '--max-trace-lines');
        else if (a === '--similarity-threshold') {
            const val = parsePositiveFloatFlag(argv[++i], '--similarity-threshold');
            breaker.similarityThreshold = val;
            prune.similarityThreshold = val;
        }
    }
    return { help: false, ledger, ...base() };
}
async function readLedger(pathArg) {
    const raw = pathArg
        ? await readFile(pathArg, 'utf8')
        : await readStdin();
    if (!raw.trim()) {
        throw new Error('No ledger provided. Pass --ledger <file.json> or pipe JSON on stdin.');
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.goal !== 'string' || !Array.isArray(parsed.attempts)) {
        throw new Error('Invalid ledger: expected { goal: string, attempts: Attempt[] }.');
    }
    return parsed;
}
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (c) => (data += c));
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}
const HELP = `loop-context — stateful memory manager for agent loops

Keeps a loop's context window clean and stops runaway loops. Reads a run ledger
(JSON) and summarizes, prunes, injects, or applies the circuit breaker.

Usage:
  loop-context [operation] [--ledger <file.json>] [options]
  cat ledger.json | loop-context --check
  loop-context --check --ledger run.json --budget-from-pattern ci-sweeper --budget-level L2
  loop-context --check --ledger run.json --daily-budget-from-pattern ci-sweeper --on-exceed ./on-exceed.sh

Operations (default: --status):
  --check      Run the circuit breaker. Exit 0 = continue, 2 = escalate.
  --prune      Emit a pruned ledger (recent window, trimmed traces, collapsed).
  --inject     Emit the compact context block for the next prompt.
  --summary    Emit a factual rollup of the run.
  --status     Human-readable overview (summary + breaker decision).

Options:
  -f, --ledger <file>       Ledger JSON file (default: stdin)
  --json                    Machine-readable output where applicable
  --max-iterations <n>      Iteration cap (default: ${DEFAULT_BREAKER.maxIterations})
  --stagnation <n>          Same-error repeat limit (default: ${DEFAULT_BREAKER.stagnationThreshold})
  --no-progress <n>         Consecutive-failure limit (default: ${DEFAULT_BREAKER.noProgressThreshold})
  --token-budget <n>        Total token cap (default: none)
  --budget-from-pattern <id>
                            Resolve the token cap from loop-cost's registry
                            estimate instead of typing a number. Ignored if
                            --token-budget is also given (explicit wins).
  --budget-level <L1|L2|L3> Readiness level for --budget-from-pattern (default: L1)
  --budget-scenario <realistic|action|report|caching>
                            Which loop-cost scenario to use (default: realistic).
                            caching requires stable_fraction set on the pattern
                            in registry.yaml (see loop-cost --with-caching).
  --budget-cadence <spec>   Cadence override passed through to loop-cost
  --budget-conservative     Use the slower cadence in a range (loop-cost flag)
  --daily-budget-from-pattern <id>
                            Track cumulative daily spend for this pattern
                            across separate --check calls/runs and escalate
                            (trigger: daily-budget) once it reaches loop-cost's
                            suggested daily cap. Ignored if a per-run trigger
                            already escalated. Uses --budget-level/-cadence/
                            -conservative for the lookup.
  --daily-state-dir <dir>  Where daily-spend.<pattern>.json is kept (default: .loop-context)
  --on-exceed <script>      On escalate, pipe the decision as JSON to this
                            script's stdin (fire-and-forget; its exit code
                            is not checked and does not change --check's own).
  --similarity-threshold <f> Float 0.0-1.0 to cluster similar errors (default: ${DEFAULT_BREAKER.similarityThreshold})
  --window <n>              Attempts kept when pruning (default: ${DEFAULT_PRUNE.window})
  --max-trace-lines <n>     Stack-trace lines kept (default: ${DEFAULT_PRUNE.maxTraceLines})
  -h, --help                This help

Ledger shape:
  { "goal": "...", "attempts": [ { "iteration": 1, "action": "...",
    "outcome": "failure", "error": "...", "tokensUsed": 1200 } ] }

Exit codes: 0 continue · 2 escalate · 1 error
`;
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(HELP);
        return;
    }
    if (args.budgetFromPattern && args.breaker.tokenBudget === undefined) {
        args.breaker.tokenBudget = await resolveTokenBudgetFromPattern({
            pattern: args.budgetFromPattern,
            level: args.budgetLevel,
            scenario: args.budgetScenario,
            cadence: args.budgetCadence,
            conservative: args.budgetConservative,
        });
    }
    const ledger = await readLedger(args.ledger);
    switch (args.op) {
        case 'check': {
            let decision = checkCircuitBreaker(ledger, args.breaker);
            if (args.dailyBudgetFromPattern) {
                decision = await applyDailyBudget(decision, ledger, args);
            }
            if (decision.escalate && args.onExceed) {
                await runOnExceedHook(args.onExceed, decision);
            }
            if (args.json)
                console.log(JSON.stringify(decision, null, 2));
            else
                console.log(`${decision.escalate ? 'ESCALATE' : 'CONTINUE'} [${decision.trigger}] — ${decision.reason}`);
            process.exitCode = decision.escalate ? 2 : 0;
            return;
        }
        case 'prune':
            console.log(JSON.stringify(pruneLedger(ledger, args.prune), null, 2));
            return;
        case 'summary': {
            const summary = summarizeAttempts(ledger);
            if (args.json)
                console.log(JSON.stringify(summary, null, 2));
            else
                console.log(formatSummary(summary));
            return;
        }
        case 'inject':
            console.log(buildContextInjection(ledger, args.breaker, args.prune));
            return;
        case 'status':
        default: {
            const summary = summarizeAttempts(ledger);
            const decision = checkCircuitBreaker(ledger, args.breaker);
            console.log(formatSummary(summary));
            console.log('');
            console.log(`Circuit breaker: ${decision.escalate ? 'ESCALATE' : 'CONTINUE'} [${decision.trigger}]`);
            console.log(`  ${decision.reason}`);
            process.exitCode = decision.escalate ? 2 : 0;
            return;
        }
    }
}
/**
 * Add the newest attempt's tokensUsed to the pattern's running daily total
 * (rolling over on UTC date change) and, if that total reaches loop-cost's
 * suggested daily cap, override the decision to escalate — but only when no
 * per-run trigger already fired.
 */
async function applyDailyBudget(decision, ledger, args) {
    const pattern = args.dailyBudgetFromPattern;
    const latest = ledger.attempts[ledger.attempts.length - 1];
    const tokensDelta = latest?.tokensUsed ?? 0;
    const state = await recordDailySpend(args.dailyStateDir, pattern, tokensDelta);
    if (decision.escalate)
        return decision;
    const dailyCap = await resolveDailyBudgetFromPattern({
        pattern,
        level: args.budgetLevel,
        cadence: args.budgetCadence,
        conservative: args.budgetConservative,
    });
    if (state.tokensUsedToday >= dailyCap) {
        return {
            ...decision,
            shouldContinue: false,
            escalate: true,
            trigger: 'daily-budget',
            reason: `Daily token spend for pattern "${pattern}" reached ${state.tokensUsedToday} (cap ${dailyCap}). Escalating to avoid cost blowup.`,
        };
    }
    return decision;
}
/** Pipe the escalation decision as JSON to an operator-provided script's stdin. Fire-and-forget. */
function runOnExceedHook(script, decision) {
    return new Promise((resolve) => {
        const child = spawn(script, [], { stdio: ['pipe', 'inherit', 'inherit'], shell: true });
        child.on('error', (err) => {
            console.error(`loop-context: --on-exceed hook failed to start: ${err.message}`);
            resolve();
        });
        child.on('close', () => resolve());
        child.stdin.write(JSON.stringify(decision));
        child.stdin.end();
    });
}
function formatSummary(s) {
    const lines = [];
    lines.push(`Attempts: ${s.totalAttempts}  (${s.successes} ok · ${s.failures} failed · ${s.noops} no-op)`);
    if (s.tokensUsed)
        lines.push(`Tokens used: ${s.tokensUsed}`);
    if (s.distinctErrors.length) {
        lines.push('Distinct errors (most frequent first):');
        for (const g of s.distinctErrors)
            lines.push(`  (${g.count}×) ${g.sample}`);
    }
    if (s.actionsTried.length) {
        lines.push('Actions tried:');
        for (const a of s.actionsTried)
            lines.push(`  - ${a}`);
    }
    return lines.join('\n');
}
main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('loop-context failed:', msg);
    process.exit(1);
});
