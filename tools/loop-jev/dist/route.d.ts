/**
 * Model routing: one Jev call picks a cheap-enough coding-agent tier.
 *
 * Jev returns typed Choice/Score/Noul answers; this module maps them onto
 * a concrete model id. Low confidence does not blindly follow the Choice —
 * it falls back to `balanced` so an uncertain call does not overspend or
 * underpower the turn.
 */
import { type SystemOneFn } from './client.js';
export type ModelTier = 'nano' | 'fast' | 'balanced' | 'frontier' | 'reasoning';
export declare const TIERS: Record<ModelTier, {
    model: string;
    cost: string;
    use: string;
}>;
export declare const TIER_CRITERIA: Record<ModelTier, string>;
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
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export declare const LOW_CONFIDENCE = 0.55;
export declare function heuristicRoute(input: RouteInput): RouteDecision;
export declare function routeQuestions(): {
    tier: import("./questions.js").ChoiceQuestion;
    difficulty: import("./questions.js").ScoreQuestion;
    needs_tools: import("./questions.js").NoulQuestion;
    needs_long_context: import("./questions.js").NoulQuestion;
    needs_maker_checker: import("./questions.js").NoulQuestion;
};
export declare function routeTask(input: RouteInput, opts?: {
    systemOne?: SystemOneFn;
    allowFallback?: boolean;
}): Promise<RouteDecision>;
