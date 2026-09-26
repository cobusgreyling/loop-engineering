/**
 * Model routing: one Jev call picks a cheap-enough coding-agent tier.
 *
 * Jev returns typed Choice/Score/Noul answers; this module maps them onto
 * a concrete model id. Low confidence does not blindly follow the Choice —
 * it falls back to `balanced` so an uncertain call does not overspend or
 * underpower the turn.
 */

import { asChoice, asNoul, asScore, choice, noul, score } from './questions.js';
import { createClient, keyIsConfigured, resolveApiKey, type SystemOneFn } from './client.js';
import { redactSecrets } from './redact.js';

export type ModelTier = 'nano' | 'fast' | 'balanced' | 'frontier' | 'reasoning';

export const TIERS: Record<
  ModelTier,
  { model: string; cost: string; use: string }
> = {
  nano: {
    model: 'grok-fast',
    cost: 'lowest',
    use: 'Typos, format, list files, one-line edits, noop scans',
  },
  fast: {
    model: 'grok',
    cost: 'low',
    use: 'L1 triage, issue classification, changelog drafts',
  },
  balanced: {
    model: 'claude-sonnet',
    cost: 'medium',
    use: 'L2 focused patches, PR comments, dependency patches',
  },
  frontier: {
    model: 'claude-opus',
    cost: 'high',
    use: 'Ambiguous multi-file refactors, CI root-cause, architecture',
  },
  reasoning: {
    model: 'grok-4.5-thinking',
    cost: 'highest',
    use: 'Verifier, security review, maker/checker, policy judgment',
  },
};

export const TIER_CRITERIA: Record<ModelTier, string> = {
  nano: 'Trivial, local, and unambiguous: typo, format, list, one-line edit, or a no-op scan.',
  fast: 'Standard report-only or classification work: daily triage, changelog draft, issue labelling.',
  balanced: 'Typical assisted code change: focused patch, PR comment, low-risk dependency bump.',
  frontier: 'Hard or ambiguous: multi-file refactor, unclear CI root cause, design trade-off.',
  reasoning: 'Needs a second opinion: verifier, security review, maker/checker, or policy call.',
};

export type RouteInput = {
  goal: string;
  pattern?: string;
  level?: 'L1' | 'L2' | 'L3';
  files?: string[];
  notes?: string;
};

export type RouteDecision = {
  tier: ModelTier;
  model: string;
  confidence: number;
  uncertain: boolean;
  difficulty: number;
  needsTools: number;
  needsLongContext: number;
  needsMakerChecker: number;
  probabilities: Record<string, number>;
  source: 'jev' | 'fallback';
  modelName?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export const LOW_CONFIDENCE = 0.55;

function clampTier(value: string | undefined): ModelTier {
  if (value === 'nano' || value === 'fast' || value === 'balanced' || value === 'frontier' || value === 'reasoning') {
    return value;
  }
  return 'balanced';
}

export function heuristicRoute(input: RouteInput): RouteDecision {
  const text = [input.goal, input.pattern, input.level, input.notes, ...(input.files ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const files = input.files?.length ?? 0;
  let tier: ModelTier = 'balanced';

  if (
    /\b(typo|format|whitespace|rename|list files|noop|one-line)\b/.test(text) &&
    files <= 2
  ) {
    tier = 'nano';
  } else if (
    input.level === 'L1' ||
    /\b(triage|changelog|label|classify|report-only|draft notes)\b/.test(text)
  ) {
    tier = 'fast';
  }

  if (
    /\b(refactor|architecture|root cause|multi-file|ambiguous|redesign)\b/.test(text) ||
    files >= 8
  ) {
    tier = 'frontier';
  }

  if (
    /\b(verif|security|maker.?checker|policy|audit|review the patch)\b/.test(text) ||
    input.level === 'L3'
  ) {
    tier = 'reasoning';
  }

  const needsMakerChecker =
    tier === 'reasoning' || tier === 'frontier' || input.level === 'L3' ? 0.85 : 0.15;
  const difficulty = { nano: 0.2, fast: 0.8, balanced: 1.4, frontier: 2.2, reasoning: 2.6 }[tier];

  return {
    tier,
    model: TIERS[tier].model,
    confidence: 0.4,
    uncertain: true,
    difficulty,
    needsTools: /\b(edit|patch|implement|fix|write)\b/.test(text) ? 0.8 : 0.3,
    needsLongContext: files >= 6 || /\b(whole repo|large diff|trace)\b/.test(text) ? 0.7 : 0.2,
    needsMakerChecker,
    probabilities: { [tier]: 1 },
    source: 'fallback',
  };
}

export function routeQuestions() {
  return {
    tier: choice(
      {
        question: 'Which coding-agent model tier should handle this loop task?',
        focus: 'Pick the cheapest tier that can still do the job. Prefer underpowering a report-only task over overspending.',
      },
      TIER_CRITERIA,
    ),
    difficulty: score('How hard is this task for a coding agent?', [
      'Trivial: a human would do it in under a minute',
      'Routine: standard loop work, one clear next action',
      'Hard: several files or an unclear cause, but scoped',
      'Severe: ambiguous, high-blast-radius, or needs a verifier',
    ]),
    needs_tools: noul('Does this task need to call tools (edit files, run tests, git)?', {
      true: 'It requires tool use, not just a written report',
      false: 'A text reply or STATE.md update is enough',
    }),
    needs_long_context: noul('Does this task need a large context window (big diffs, long traces, many files)?', {
      true: 'The relevant state is large',
      false: 'A short goal plus a few files is enough',
    }),
    needs_maker_checker: noul('Should a second agent verify the first (maker/checker)?', {
      true: 'A verifier should run before any merge or apply',
      false: 'A single pass is enough (report-only or trivial)',
    }),
  };
}

export async function routeTask(
  input: RouteInput,
  opts: { systemOne?: SystemOneFn; allowFallback?: boolean } = {},
): Promise<RouteDecision> {
  const allowFallback = opts.allowFallback !== false;
  const call = opts.systemOne ?? (keyIsConfigured(await resolveApiKey()) ? createClient() : undefined);

  if (!call) {
    if (!allowFallback) {
      throw new Error('Jev routing requires a TypeSafe API key (fallback disabled).');
    }
    return heuristicRoute(input);
  }

  const started = Date.now();
  void started;
  const response = await call({
    state: redactSecrets({
      goal: input.goal,
      pattern: input.pattern ?? null,
      level: input.level ?? null,
      files: input.files ?? [],
      notes: input.notes ?? null,
    }),
    questions: routeQuestions(),
  });

  const picked = asChoice(response.answers.tier);
  const rawTier = clampTier(picked?.choice);
  const confidence = picked?.confidence ?? 0;
  const uncertain = confidence < LOW_CONFIDENCE;
  const tier = uncertain && rawTier !== 'nano' ? 'balanced' : rawTier;

  return {
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
}
