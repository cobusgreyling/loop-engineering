/**
 * LLM error detection + guardrails.
 *
 * One Jev request screens a message on the way in (user / ticket / skill
 * prompt) or on the way out (model reply / tool argument). Hazards are Noul
 * questions; harm is a Score. Thresholds live in this file — Jev assesses,
 * code decides pass / review / block / support.
 *
 * Pair with loop-gate (path denylist) and loop-context (run history). This
 * layer catches jailbreaks, prompt injection, secret leaks, and instruction
 * drift that glob policy cannot see.
 */
import { type Questions } from './questions.js';
import { type SystemOneFn } from './client.js';
export type GuardSide = 'input' | 'output';
export type GuardPolicyName = 'strict' | 'permissive';
export type GuardAction = 'pass' | 'review' | 'block' | 'support';
export type GuardInput = {
    text: string;
    side: GuardSide;
    policy?: GuardPolicyName;
};
export type GuardDecision = {
    action: GuardAction;
    side: GuardSide;
    policy: GuardPolicyName;
    nouls: Record<string, number>;
    severity: number;
    topHazard: string;
    topProbability: number;
    source: 'jev' | 'fallback';
    modelName?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export declare const HAZARD_ACTION: Record<string, GuardAction>;
export declare const POLICIES: Record<GuardPolicyName, {
    review: number;
    action: number;
    severityBlock: number;
}>;
export declare function inputBattery(): Questions;
export declare function outputBattery(): Questions;
export declare function routeGuard(nouls: Record<string, number>, severity: number, policyName: GuardPolicyName): GuardAction;
export declare function heuristicGuard(input: GuardInput): GuardDecision;
export declare function guardText(input: GuardInput, opts?: {
    systemOne?: SystemOneFn;
    allowFallback?: boolean;
}): Promise<GuardDecision>;
export declare function guardExitCode(action: GuardAction): number;
