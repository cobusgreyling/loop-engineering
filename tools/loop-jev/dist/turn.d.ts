/**
 * One-call turn assessor: model routing + input guardrails in a single
 * TypeSafe request (speculative fan-out). Code then composes the answers.
 */
import { type SystemOneFn } from './client.js';
import { type GuardAction, type GuardDecision, type GuardPolicyName } from './guard.js';
import { type RouteDecision, type RouteInput } from './route.js';
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
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export declare function assessTurn(input: TurnInput, opts?: {
    systemOne?: SystemOneFn;
    allowFallback?: boolean;
}): Promise<TurnDecision>;
