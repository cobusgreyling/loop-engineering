/** Typed TypeSafe System One question builders. */

export type NoulQuestion = {
  type: 'noul';
  instructions: unknown;
  criteria?: { true?: unknown; false?: unknown };
};

export type ChoiceQuestion = {
  type: 'choice';
  instructions: unknown;
  criteria: Record<string, unknown>;
};

export type ScoreQuestion = {
  type: 'score';
  instructions: unknown;
  criteria: unknown[];
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type Questions = Record<string, Question>;

export type NoulAnswer = { type: 'noul'; noul: number };
export type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: 'score';
  score: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
  confidence: number;
};
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export function noul(
  instructions: unknown,
  criteria?: { true?: unknown; false?: unknown },
): NoulQuestion {
  return criteria ? { type: 'noul', instructions, criteria } : { type: 'noul', instructions };
}

export function choice(instructions: unknown, criteria: Record<string, unknown>): ChoiceQuestion {
  return { type: 'choice', instructions, criteria };
}

export function score(instructions: unknown, criteria: unknown[]): ScoreQuestion {
  return { type: 'score', instructions, criteria };
}

export function asNoul(answer: Answer | undefined, fallback = 0): number {
  return answer && answer.type === 'noul' ? answer.noul : fallback;
}

export function asChoice(answer: Answer | undefined): ChoiceAnswer | undefined {
  return answer && answer.type === 'choice' ? answer : undefined;
}

export function asScore(answer: Answer | undefined, fallback = 0): number {
  return answer && answer.type === 'score' ? answer.score : fallback;
}
