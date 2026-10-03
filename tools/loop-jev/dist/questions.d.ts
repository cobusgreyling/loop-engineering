/** Typed TypeSafe System One question builders. */
export type NoulQuestion = {
    type: 'noul';
    instructions: unknown;
    criteria?: {
        true?: unknown;
        false?: unknown;
    };
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
export type NoulAnswer = {
    type: 'noul';
    noul: number;
};
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
export declare function noul(instructions: unknown, criteria?: {
    true?: unknown;
    false?: unknown;
}): NoulQuestion;
export declare function choice(instructions: unknown, criteria: Record<string, unknown>): ChoiceQuestion;
export declare function score(instructions: unknown, criteria: unknown[]): ScoreQuestion;
export declare function asNoul(answer: Answer | undefined, fallback?: number): number;
export declare function asChoice(answer: Answer | undefined): ChoiceAnswer | undefined;
export declare function asScore(answer: Answer | undefined, fallback?: number): number;
