/**
 * Semantic context retrieval: one Jev call ranks candidate passages.
 *
 * Speculative fan-out: a Choice over passage ids (probabilities = ranking)
 * plus a Noul for "does any passage actually answer this?" plus a Score per
 * passage. Code then keeps the ones above threshold.
 */
import { type SystemOneFn } from './client.js';
export type Passage = {
    id: string;
    text: string;
};
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
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export declare const MAX_PASSAGES = 40;
export declare const DEFAULT_TOP = 8;
export declare const DEFAULT_MIN_RELEVANCE = 1;
export declare function heuristicRetrieve(input: RetrieveInput): RetrieveDecision;
export declare function retrieveQuestions(passages: Passage[]): Record<string, import("./questions.js").NoulQuestion | import("./questions.js").ChoiceQuestion | import("./questions.js").ScoreQuestion>;
export declare function retrieveContext(input: RetrieveInput, opts?: {
    systemOne?: SystemOneFn;
    allowFallback?: boolean;
}): Promise<RetrieveDecision>;
