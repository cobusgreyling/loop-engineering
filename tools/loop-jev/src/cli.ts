#!/usr/bin/env node
/**
 * loop-jev — TypeSafe Jev decision layer for Loop Engineering.
 *
 * Exit codes follow loop-gate / loop-context: 0 proceed · 2 escalate · 1 error.
 */

import { resolveApiKey, keyIsConfigured, describeKeySource, DEFAULT_ENDPOINT, DEFAULT_MODEL } from './client.js';
import { routeTask, TIERS } from './route.js';
import { retrieveContext } from './retrieve.js';
import { guardText, guardExitCode, type GuardPolicyName, type GuardSide } from './guard.js';
import { classifyTrace, classifyExitCode } from './classify.js';
import { assessTurn } from './turn.js';
import { loadClassifyInput, loadPassages, readTextArg } from './io.js';

const HELP = `loop-jev — TypeSafe Jev (System One) decision layer for loops

Jev is not a language model. It answers typed Choice / Score / Noul questions
with calibrated probabilities — model routing, semantic retrieval, LLM
guardrails, and trace classification at ~$0.042/MTok and sub-second latency.

Usage:
  loop-jev route --goal <text> [--pattern id] [--level L1|L2|L3] [--files f1,f2] [--json]
  loop-jev retrieve --query <text> --passages <file.json> [--top N] [--json]
  loop-jev guard --text <text|-> --side input|output [--policy strict|permissive] [--json]
  loop-jev classify --trace <file.jsonl> [--json]
  loop-jev turn --goal <text> [--message <text>] [--json]
  loop-jev doctor [--json]

Auth (never printed):
  TYPESAFE_API_KEY  or  ~/.config/typesafe/api_key  (mode 600)
  TYPESAFE_KEY_FILE overrides the key file path (tests).

Without a key, a local heuristic fallback runs so CI stays green. Pass
--no-fallback to require a live Jev call.

Exit codes: 0 proceed · 2 escalate (guard block/review, classify escalate) · 1 error
`;

type Flags = {
  help: boolean;
  json: boolean;
  noFallback: boolean;
  goal?: string;
  pattern?: string;
  level?: 'L1' | 'L2' | 'L3';
  files?: string;
  notes?: string;
  query?: string;
  passages?: string;
  top?: number;
  text?: string;
  side?: string;
  policy?: string;
  trace?: string;
  message?: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { help: false, json: false, noFallback: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      return v;
    };
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--no-fallback') flags.noFallback = true;
    else if (a === '--goal') flags.goal = next();
    else if (a === '--pattern' || a === '-p') flags.pattern = next();
    else if (a === '--level' || a === '-l') flags.level = next() as Flags['level'];
    else if (a === '--files') flags.files = next();
    else if (a === '--notes') flags.notes = next();
    else if (a === '--query') flags.query = next();
    else if (a === '--passages') flags.passages = next();
    else if (a === '--top') flags.top = Number(next());
    else if (a === '--text') flags.text = next();
    else if (a === '--side') flags.side = next();
    else if (a === '--policy') flags.policy = next();
    else if (a === '--trace') flags.trace = next();
    else if (a === '--message') flags.message = next();
    else if (!a.startsWith('-') && !flags.goal && !flags.text) flags.text = a;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function cmdDoctor(flags: Flags): Promise<number> {
  const key = await resolveApiKey();
  const configured = keyIsConfigured(key);
  const report = {
    configured,
    source: configured ? describeKeySource() : 'none',
    endpoint: process.env.TYPESAFE_ENDPOINT || DEFAULT_ENDPOINT,
    model: process.env.TYPESAFE_MODEL || DEFAULT_MODEL,
    fallback: !configured,
  };
  if (flags.json) printJson(report);
  else if (configured) {
    console.log(`Jev: configured (${report.source}). Endpoint ${report.endpoint}. Model ${report.model}.`);
  } else {
    console.log('Jev: no API key. Heuristic fallback will run.');
    console.log('Set TYPESAFE_API_KEY or write ~/.config/typesafe/api_key (chmod 600).');
  }
  return configured ? 0 : 1;
}

async function cmdRoute(flags: Flags): Promise<number> {
  const goal = flags.goal || flags.text;
  if (!goal) throw new Error('route requires --goal');
  const files = flags.files ? flags.files.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const decision = await routeTask(
    { goal, pattern: flags.pattern, level: flags.level, files, notes: flags.notes },
    { allowFallback: !flags.noFallback },
  );
  if (flags.json) printJson(decision);
  else {
    const hint = TIERS[decision.tier];
    console.log(
      `${decision.uncertain ? 'UNCERTAIN' : 'ROUTE'} ${decision.tier} → ${decision.model}  conf=${decision.confidence.toFixed(2)}  source=${decision.source}`,
    );
    console.log(`${hint.use} (${hint.cost})`);
    if (decision.needsMakerChecker >= 0.7) console.log('Recommend maker/checker before apply.');
  }
  return 0;
}

async function cmdRetrieve(flags: Flags): Promise<number> {
  if (!flags.query) throw new Error('retrieve requires --query');
  if (!flags.passages) throw new Error('retrieve requires --passages <file.json>');
  const passages = await loadPassages(flags.passages);
  const decision = await retrieveContext(
    { query: flags.query, passages, top: flags.top },
    { allowFallback: !flags.noFallback },
  );
  if (flags.json) printJson(decision);
  else {
    console.log(
      `RETRIEVE kept ${decision.kept.length}/${decision.ranked.length}  contains=${decision.containsAnswer.toFixed(2)}  source=${decision.source}`,
    );
    for (const p of decision.kept) {
      console.log(`  ${p.id}  rel=${p.relevance.toFixed(2)}  p=${p.probability.toFixed(2)}  ${p.text.slice(0, 80)}`);
    }
  }
  return decision.containsAnswer < 0.3 && decision.kept.length === 0 ? 2 : 0;
}

async function cmdGuard(flags: Flags): Promise<number> {
  const text = await readTextArg(flags.text || flags.goal);
  const side = (flags.side || 'input') as GuardSide;
  if (side !== 'input' && side !== 'output') throw new Error('--side must be input or output');
  const policy = (flags.policy || 'strict') as GuardPolicyName;
  if (policy !== 'strict' && policy !== 'permissive') throw new Error('--policy must be strict or permissive');
  const decision = await guardText({ text, side, policy }, { allowFallback: !flags.noFallback });
  if (flags.json) printJson(decision);
  else {
    console.log(
      `${decision.action.toUpperCase()} [${decision.topHazard}=${decision.topProbability.toFixed(2)} sev=${decision.severity.toFixed(2)}] source=${decision.source}`,
    );
  }
  return guardExitCode(decision.action);
}

async function cmdClassify(flags: Flags): Promise<number> {
  if (!flags.trace) throw new Error('classify requires --trace <file>');
  const input = await loadClassifyInput(flags.trace);
  const decision = await classifyTrace(input, { allowFallback: !flags.noFallback });
  if (flags.json) printJson(decision);
  else {
    console.log(
      `${decision.failureMode.toUpperCase()} conf=${decision.confidence.toFixed(2)} escalate=${decision.shouldEscalate.toFixed(2)} source=${decision.source}`,
    );
  }
  return classifyExitCode(decision);
}

async function cmdTurn(flags: Flags): Promise<number> {
  const goal = flags.goal || flags.text;
  if (!goal) throw new Error('turn requires --goal');
  const files = flags.files ? flags.files.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const decision = await assessTurn(
    {
      goal,
      message: flags.message,
      pattern: flags.pattern,
      level: flags.level,
      files,
      notes: flags.notes,
      policy: (flags.policy as GuardPolicyName) || 'strict',
    },
    { allowFallback: !flags.noFallback },
  );
  if (flags.json) printJson(decision);
  else {
    console.log(
      `TURN ${decision.action.toUpperCase()}  ${decision.route.tier} → ${decision.route.model}  source=${decision.source}`,
    );
    console.log(
      `guard ${decision.guard.topHazard}=${decision.guard.topProbability.toFixed(2)}  route conf=${decision.route.confidence.toFixed(2)}`,
    );
  }
  return guardExitCode(decision.action);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return command ? 0 : 1;
  }

  const flags = parseFlags(argv.slice(1));
  if (flags.help) {
    console.log(HELP);
    return 0;
  }

  switch (command) {
    case 'doctor':
      return cmdDoctor(flags);
    case 'route':
      return cmdRoute(flags);
    case 'retrieve':
      return cmdRetrieve(flags);
    case 'guard':
      return cmdGuard(flags);
    case 'classify':
      return cmdClassify(flags);
    case 'turn':
      return cmdTurn(flags);
    default:
      console.error(`Unknown command "${command}".\n`);
      console.log(HELP);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
