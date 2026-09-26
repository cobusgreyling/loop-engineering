/**
 * Reasoning-trace classification.
 *
 * Pack a compact view of a loop run (trace events, loop-context ledger, or
 * run-log excerpt) into one Jev call. Choice picks the failure mode; Score
 * rates recovery urgency; Nouls say whether to escalate or split maker/checker.
 */

import { asChoice, asNoul, asScore, choice, noul, score } from './questions.js';
import { createClient, keyIsConfigured, resolveApiKey, type SystemOneFn } from './client.js';
import { redactSecrets } from './redact.js';

export type TraceEvent = {
  type?: string;
  detail?: string;
  primitive?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

export type FailureMode =
  | 'healthy'
  | 'tool_loop'
  | 'budget_burn'
  | 'instruction_drift'
  | 'verifier_fail'
  | 'stagnation'
  | 'hallucination'
  | 'policy_denied'
  | 'worktree_collision'
  | 'other';

export const FAILURE_CRITERIA: Record<FailureMode, string> = {
  healthy: 'The run made progress toward the goal without looping or burning budget.',
  tool_loop: 'The same tool (or a near-identical call) was retried without new information.',
  budget_burn: 'Token or tool-call budget was the thing that stopped the run.',
  instruction_drift: 'The agent abandoned the stated goal or skill.',
  verifier_fail: 'A verifier or test command rejected the change.',
  stagnation: 'Repeated failures with no new hypothesis.',
  hallucination: 'The agent invented files, results, or policy the trace does not support.',
  policy_denied: 'loop-gate / denylist / auto-merge policy blocked the action.',
  worktree_collision: 'Two attempts fought over the same files or worktree.',
  other: 'A failure that does not fit the named modes.',
};

export type ClassifyInput = {
  goal?: string;
  events?: TraceEvent[];
  ledger?: { goal?: string; attempts?: Array<{ action?: string; outcome?: string; error?: string }> };
  runLogExcerpt?: string;
};

export type ClassifyDecision = {
  failureMode: FailureMode;
  confidence: number;
  uncertain: boolean;
  recoveryUrgency: number;
  shouldEscalate: number;
  needsMakerChecker: number;
  contextRot: number;
  probabilities: Record<string, number>;
  source: 'jev' | 'fallback';
  modelName?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const LOW_CONFIDENCE = 0.55;

function clampMode(value: string | undefined): FailureMode {
  if (value && value in FAILURE_CRITERIA) return value as FailureMode;
  return 'other';
}

function compactEvents(events: TraceEvent[], limit = 40): TraceEvent[] {
  return events.slice(-limit).map((e) => ({
    type: e.type,
    primitive: e.primitive,
    detail: typeof e.detail === 'string' ? e.detail.slice(0, 200) : undefined,
  }));
}

export function heuristicClassify(input: ClassifyInput): ClassifyDecision {
  const events = input.events ?? [];
  const types = events.map((e) => (e.type ?? '').toLowerCase());
  const blob = [
    input.goal,
    input.runLogExcerpt,
    ...events.map((e) => `${e.type ?? ''} ${e.detail ?? ''}`),
    ...(input.ledger?.attempts ?? []).map((a) => `${a.action ?? ''} ${a.outcome ?? ''} ${a.error ?? ''}`),
  ]
    .join('\n')
    .toLowerCase();

  const toolCalls = types.filter((t) => t.includes('tool.call') || t === 'tool.call').length;
  const uniqueTools = new Set(
    events.filter((e) => (e.type ?? '').includes('tool')).map((e) => e.detail ?? e.primitive ?? ''),
  );
  let mode: FailureMode = 'healthy';

  if (types.some((t) => t.includes('budget'))) mode = 'budget_burn';
  else if (types.some((t) => t.includes('policy'))) mode = 'policy_denied';
  else if (types.some((t) => t.includes('verification.fail') || t.includes('verifier'))) mode = 'verifier_fail';
  else if (toolCalls >= 6 && uniqueTools.size <= 2) mode = 'tool_loop';
  else if (/\b(stagnat|same error|no progress)\b/.test(blob)) mode = 'stagnation';
  else if (/\b(drift|abandoned the goal)\b/.test(blob)) mode = 'instruction_drift';
  else if (/\bhallucin/.test(blob)) mode = 'hallucination';
  else if (/\bworktree\b/.test(blob) && /\b(collision|conflict|lock)\b/.test(blob)) mode = 'worktree_collision';
  else if (types.some((t) => t === 'error' || t.endsWith('.error'))) mode = 'other';

  const shouldEscalate = mode === 'healthy' ? 0.1 : 0.8;
  const urgency = mode === 'healthy' ? 0.2 : mode === 'budget_burn' || mode === 'tool_loop' ? 2.2 : 1.4;
  const needsMakerChecker = mode === 'verifier_fail' || mode === 'hallucination' ? 0.85 : 0.3;

  return {
    failureMode: mode,
    confidence: 0.4,
    uncertain: true,
    recoveryUrgency: urgency,
    shouldEscalate,
    needsMakerChecker,
    contextRot: events.length > 30 ? 0.7 : 0.2,
    probabilities: { [mode]: 1 },
    source: 'fallback',
  };
}

export function classifyQuestions() {
  return {
    failure_mode: choice(
      {
        question: 'What is the primary failure mode of this loop run?',
        focus: 'Pick healthy if the run completed useful work. Prefer a specific mode over other.',
      },
      FAILURE_CRITERIA,
    ),
    recovery_urgency: score('How urgently does a human need to intervene?', [
      'No urgency: healthy or already recovered',
      'Soon: the next scheduled run should change tactic',
      'Now: stop the loop before it burns more budget',
      'Immediate: safety, secrets, or a stuck unattended loop',
    ]),
    should_escalate: noul('Should this run escalate to a human instead of retrying?', {
      true: 'Retrying will not help; a human should see the trace',
      false: 'Another attempt (or a no-op) is reasonable',
    }),
    needs_maker_checker: noul('Would splitting maker/checker (or re-running the verifier) help?', {
      true: 'A second agent with different instructions should review',
      false: 'The issue is not a missing verifier',
    }),
    context_rot: noul('Is the context window polluted (repeated errors, long traces, lost goal)?', {
      true: 'Prune / re-inject before the next turn',
      false: 'Context is still usable',
    }),
  };
}

export async function classifyTrace(
  input: ClassifyInput,
  opts: { systemOne?: SystemOneFn; allowFallback?: boolean } = {},
): Promise<ClassifyDecision> {
  const allowFallback = opts.allowFallback !== false;
  const call = opts.systemOne ?? (keyIsConfigured(await resolveApiKey()) ? createClient() : undefined);

  if (!call) {
    if (!allowFallback) {
      throw new Error('Jev classify requires a TypeSafe API key (fallback disabled).');
    }
    return heuristicClassify(input);
  }

  const events = compactEvents(input.events ?? []);
  const response = await call({
    state: redactSecrets({
      goal: input.goal ?? input.ledger?.goal ?? null,
      events,
      attempts: input.ledger?.attempts ?? [],
      runLogExcerpt: input.runLogExcerpt ? String(input.runLogExcerpt).slice(0, 4000) : null,
    }),
    questions: classifyQuestions(),
  });

  const picked = asChoice(response.answers.failure_mode);
  const failureMode = clampMode(picked?.choice);
  const confidence = picked?.confidence ?? 0;

  return {
    failureMode,
    confidence,
    uncertain: confidence < LOW_CONFIDENCE,
    recoveryUrgency: asScore(response.answers.recovery_urgency),
    shouldEscalate: asNoul(response.answers.should_escalate),
    needsMakerChecker: asNoul(response.answers.needs_maker_checker),
    contextRot: asNoul(response.answers.context_rot),
    probabilities: picked?.probabilities ?? { [failureMode]: 1 },
    source: 'jev',
    modelName: response.model,
    usage: response.usage,
  };
}

export function classifyExitCode(decision: ClassifyDecision): number {
  if (decision.failureMode === 'healthy' && decision.shouldEscalate < 0.5) return 0;
  return 2;
}
