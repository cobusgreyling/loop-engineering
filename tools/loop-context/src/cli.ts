#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  buildContextInjection,
  checkCircuitBreaker,
  pruneLedger,
  summarizeAttempts,
  DEFAULT_BREAKER,
  DEFAULT_PRUNE,
  type Ledger,
  type CircuitBreakerConfig,
  type PruneConfig,
} from './context-manager.js';

type Op = 'check' | 'prune' | 'inject' | 'summary' | 'status';

interface Args {
  help: boolean;
  op: Op;
  ledger?: string;
  json: boolean;
  breaker: CircuitBreakerConfig;
  prune: PruneConfig;
}

function parseArgs(argv: string[]): Args {
  const breaker: CircuitBreakerConfig = { ...DEFAULT_BREAKER };
  const prune: PruneConfig = { ...DEFAULT_PRUNE };
  let op: Op = 'status';
  let ledger: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true, op, json, breaker, prune };
    else if (a === '--ledger' || a === '-f') ledger = argv[++i];
    else if (a === '--check') op = 'check';
    else if (a === '--prune') op = 'prune';
    else if (a === '--inject') op = 'inject';
    else if (a === '--summary') op = 'summary';
    else if (a === '--status') op = 'status';
    else if (a === '--json') json = true;
    else if (a === '--max-iterations') breaker.maxIterations = Number(argv[++i]);
    else if (a === '--stagnation') breaker.stagnationThreshold = Number(argv[++i]);
    else if (a === '--no-progress') breaker.noProgressThreshold = Number(argv[++i]);
    else if (a === '--token-budget') breaker.tokenBudget = Number(argv[++i]);
    else if (a === '--window') prune.window = Number(argv[++i]);
    else if (a === '--max-trace-lines') prune.maxTraceLines = Number(argv[++i]);
  }

  return { help: false, op, ledger, json, breaker, prune };
}

async function readLedger(pathArg?: string): Promise<Ledger> {
  const raw = pathArg
    ? await readFile(pathArg, 'utf8')
    : await readStdin();
  if (!raw.trim()) {
    throw new Error('No ledger provided. Pass --ledger <file.json> or pipe JSON on stdin.');
  }
  const parsed = JSON.parse(raw) as Ledger;
  if (typeof parsed.goal !== 'string' || !Array.isArray(parsed.attempts)) {
    throw new Error('Invalid ledger: expected { goal: string, attempts: Attempt[] }.');
  }
  return parsed;
}

function readStdin(): Promise<string> {
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

  const ledger = await readLedger(args.ledger);

  switch (args.op) {
    case 'check': {
      const decision = checkCircuitBreaker(ledger, args.breaker);
      if (args.json) console.log(JSON.stringify(decision, null, 2));
      else console.log(`${decision.escalate ? 'ESCALATE' : 'CONTINUE'} [${decision.trigger}] — ${decision.reason}`);
      process.exitCode = decision.escalate ? 2 : 0;
      return;
    }
    case 'prune':
      console.log(JSON.stringify(pruneLedger(ledger, args.prune), null, 2));
      return;
    case 'summary': {
      const summary = summarizeAttempts(ledger);
      if (args.json) console.log(JSON.stringify(summary, null, 2));
      else console.log(formatSummary(summary));
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

function formatSummary(s: ReturnType<typeof summarizeAttempts>): string {
  const lines: string[] = [];
  lines.push(`Attempts: ${s.totalAttempts}  (${s.successes} ok · ${s.failures} failed · ${s.noops} no-op)`);
  if (s.tokensUsed) lines.push(`Tokens used: ${s.tokensUsed}`);
  if (s.distinctErrors.length) {
    lines.push('Distinct errors (most frequent first):');
    for (const g of s.distinctErrors) lines.push(`  (${g.count}×) ${g.sample}`);
  }
  if (s.actionsTried.length) {
    lines.push('Actions tried:');
    for (const a of s.actionsTried) lines.push(`  - ${a}`);
  }
  return lines.join('\n');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('loop-context failed:', msg);
  process.exit(1);
});
