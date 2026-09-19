/**
 * One-call turn assessor: model routing + input guardrails in a single
 * TypeSafe request (speculative fan-out). Code then composes the answers.
 */

import { asChoice, asNoul, asScore } from './questions.js';
import { createClient, keyIsConfigured, resolveApiKey, type SystemOneFn } from './client.js';
import { redactSecrets } from './redact.js';
import {
  heuristicGuard,
  inputBattery,
  routeGuard,
  type GuardAction,
  type GuardDecision,
  type GuardPolicyName,
} from './guard.js';
import {
  heuristicRoute,
  LOW_CONFIDENCE,
  routeQuestions,
  TIERS,
  type ModelTier,
  type RouteDecision,
  type RouteInput,
} from './route.js';

export type TurnInput = RouteInput & {
  message?: string;
  policy?: GuardPolicyName;
};

export type TurnDecision = {
  route: RouteDecision;
  guard: GuardDecision;
  action: GuardAction;
  source: 'jev' | 'fallback';
  modelName?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function clampTier(value: string | undefined): ModelTier {
  if (value === 'nano' || value === 'fast' || value === 'balanced' || value === 'frontier' || value === 'reasoning') {
    return value;
  }
  return 'balanced';
}

export async function assessTurn(
  input: TurnInput,
  opts: { systemOne?: SystemOneFn; allowFallback?: boolean } = {},
): Promise<TurnDecision> {
  const allowFallback = opts.allowFallback !== false;
  const policy = input.policy ?? 'strict';
  const message = input.message ?? input.goal;
  const call = opts.systemOne ?? (keyIsConfigured(await resolveApiKey()) ? createClient() : undefined);

  if (!call) {
    if (!allowFallback) {
      throw new Error('Jev turn requires a TypeSafe API key (fallback disabled).');
    }
    const route = heuristicRoute(input);
    const guard = heuristicGuard({ text: message, side: 'input', policy });
    return { route, guard, action: guard.action, source: 'fallback' };
  }

  const response = await call({
    state: redactSecrets({
      goal: input.goal,
      pattern: input.pattern ?? null,
      level: input.level ?? null,
      files: input.files ?? [],
      notes: input.notes ?? null,
      message,
    }),
    questions: {
      ...routeQuestions(),
      ...inputBattery(),
    },
  });

  const picked = asChoice(response.answers.tier);
  const rawTier = clampTier(picked?.choice);
  const confidence = picked?.confidence ?? 0;
  const uncertain = confidence < LOW_CONFIDENCE;
  const tier = uncertain && rawTier !== 'nano' ? 'balanced' : rawTier;

  const route: RouteDecision = {
    tier,
    model: TIERS[tier].model,
    confidence,
    uncertain,
    difficulty: asScore(response.answers.difficulty),
    needsTools: asNoul(response.answers.needs_tools),
    needsLongContext: asNoul(response.answers.needs_long_context),
    needsMakerChecker: asNoul(response.answers.needs_maker_checker),
    probabilities: picked?.probabilities ?? { [tier]: 1 },
    source: 'jev',
    modelName: response.model,
    usage: response.usage,
  };

  const nouls: Record<string, number> = {};
  for (const id of Object.keys(inputBattery())) {
    if (id === 'severity') continue;
    nouls[id] = asNoul(response.answers[id]);
  }
  const severity = asScore(response.answers.severity);
  const action = routeGuard(nouls, severity, policy);
  let topHazard = 'none';
  let topProbability = 0;
  for (const [k, v] of Object.entries(nouls)) {
    if (v > topProbability) {
      topHazard = k;
      topProbability = v;
    }
  }

  const guard: GuardDecision = {
    action,
    side: 'input',
    policy,
    nouls,
    severity,
    topHazard,
    topProbability,
    source: 'jev',
    modelName: response.model,
    usage: response.usage,
  };

  return {
    route,
    guard,
    action,
    source: 'jev',
    modelName: response.model,
    usage: response.usage,
  };
}
