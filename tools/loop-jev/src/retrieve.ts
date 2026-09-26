/**
 * Semantic context retrieval: one Jev call ranks candidate passages.
 *
 * Speculative fan-out: a Choice over passage ids (probabilities = ranking)
 * plus a Noul for "does any passage actually answer this?" plus a Score per
 * passage. Code then keeps the ones above threshold.
 */

import { asChoice, asNoul, asScore, choice, noul, score } from './questions.js';
import { createClient, keyIsConfigured, resolveApiKey, type SystemOneFn } from './client.js';
import { redactSecrets } from './redact.js';

export type Passage = { id: string; text: string };

export type RankedPassage = Passage & {
  relevance: number;
  probability: number;
  keep: boolean;
};

export type RetrieveInput = {
  query: string;
  passages: Passage[];
  top?: number;
  minRelevance?: number;
};

export type RetrieveDecision = {
  query: string;
  ranked: RankedPassage[];
  containsAnswer: number;
  kept: RankedPassage[];
  source: 'jev' | 'fallback';
  modelName?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export const MAX_PASSAGES = 40;
export const DEFAULT_TOP = 8;
export const DEFAULT_MIN_RELEVANCE = 1.0;

function sanitizeId(id: string, index: number): string {
  const cleaned = id.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
  return cleaned || `p${index}`;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

export function heuristicRetrieve(input: RetrieveInput): RetrieveDecision {
  const q = tokenize(input.query);
  const minRelevance = input.minRelevance ?? DEFAULT_MIN_RELEVANCE;
  const top = input.top ?? DEFAULT_TOP;

  const ranked: RankedPassage[] = input.passages.map((p) => {
    const tokens = tokenize(p.text);
    let hit = 0;
    for (const t of q) {
      if (tokens.has(t)) hit += 1;
    }
    const overlap = q.size === 0 ? 0 : hit / q.size;
    const relevance = overlap * 3;
    return {
      ...p,
      relevance,
      probability: overlap,
      keep: relevance >= minRelevance,
    };
  });

  ranked.sort((a, b) => b.relevance - a.relevance);
  const kept = ranked.filter((p) => p.keep).slice(0, top);
  const containsAnswer = kept.length > 0 ? Math.min(1, kept[0].probability + 0.2) : 0.1;

  return {
    query: input.query,
    ranked,
    containsAnswer,
    kept,
    source: 'fallback',
  };
}

export function retrieveQuestions(passages: Passage[]) {
  const criteria: Record<string, string> = {};
  const questions: Record<string, ReturnType<typeof choice> | ReturnType<typeof noul> | ReturnType<typeof score>> = {
    which: choice(
      {
        question: 'Which passage best answers the query in `state.query`?',
        focus: 'Rank by usefulness for the next coding-agent turn, not by keyword overlap alone.',
      },
      criteria,
    ),
    contains_answer: noul('Does any of these passages actually answer the query?', {
      true: 'At least one passage contains the fact or instruction needed',
      false: 'The passages are off-topic or too thin to use',
    }),
  };

  for (const [i, p] of passages.entries()) {
    const id = sanitizeId(p.id, i);
    criteria[id] = p.text.slice(0, 400);
    questions[`rel::${id}`] = score(`How relevant is passage ${id} to the query?`, [
      'Irrelevant or misleading',
      'Tangentially related',
      'Useful supporting context',
      'Directly answers the query',
    ]);
  }

  questions.which = choice(
    {
      question: 'Which passage best answers the query in `state.query`?',
      focus: 'Rank by usefulness for the next coding-agent turn, not by keyword overlap alone.',
    },
    criteria,
  );

  return questions;
}

export async function retrieveContext(
  input: RetrieveInput,
  opts: { systemOne?: SystemOneFn; allowFallback?: boolean } = {},
): Promise<RetrieveDecision> {
  const allowFallback = opts.allowFallback !== false;
  const passages = input.passages.slice(0, MAX_PASSAGES).map((p, i) => ({
    id: sanitizeId(p.id, i),
    text: String(p.text ?? '').slice(0, 2000),
  }));

  if (passages.length === 0) {
    return {
      query: input.query,
      ranked: [],
      containsAnswer: 0,
      kept: [],
      source: 'fallback',
    };
  }

  const call = opts.systemOne ?? (keyIsConfigured(await resolveApiKey()) ? createClient() : undefined);
  if (!call) {
    if (!allowFallback) {
      throw new Error('Jev retrieval requires a TypeSafe API key (fallback disabled).');
    }
    return heuristicRetrieve({ ...input, passages });
  }

  const response = await call({
    state: redactSecrets({
      query: input.query,
      passages: passages.map((p) => ({ id: p.id, text: p.text })),
    }),
    questions: retrieveQuestions(passages),
  });

  const picked = asChoice(response.answers.which);
  const minRelevance = input.minRelevance ?? DEFAULT_MIN_RELEVANCE;
  const top = input.top ?? DEFAULT_TOP;

  const ranked: RankedPassage[] = passages.map((p) => {
    const relevance = asScore(response.answers[`rel::${p.id}`]);
    const probability = picked?.probabilities?.[p.id] ?? 0;
    return {
      ...p,
      relevance,
      probability,
      keep: relevance >= minRelevance || p.id === picked?.choice,
    };
  });
  ranked.sort((a, b) => b.relevance - a.relevance || b.probability - a.probability);

  return {
    query: input.query,
    ranked,
    containsAnswer: asNoul(response.answers.contains_answer),
    kept: ranked.filter((p) => p.keep).slice(0, top),
    source: 'jev',
    modelName: response.model,
    usage: response.usage,
  };
}
