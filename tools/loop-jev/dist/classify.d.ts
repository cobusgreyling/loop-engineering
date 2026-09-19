/**
 * Reasoning-trace classification.
 *
 * Pack a compact view of a loop run (trace events, loop-context ledger, or
 * run-log excerpt) into one Jev call. Choice picks the failure mode; Score
 * rates recovery urgency; Nouls say whether to escalate or split maker/checker.
 */
import { type SystemOneFn } from './client.js';
export type TraceEvent = {
    type?: string;
    detail?: string;
    primitive?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
};
export type FailureMode = 'healthy' | 'tool_loop' | 'budget_burn' | 'instruction_drift' | 'verifier_fail' | 'stagnation' | 'hallucination' | 'policy_denied' | 'worktree_collision' | 'other';
export declare const FAILURE_CRITERIA: Record<FailureMode, string>;
export type ClassifyInput = {
    goal?: string;
    events?: TraceEvent[];
    ledger?: {
        goal?: string;
        attempts?: Array<{
            action?: string;
            outcome?: string;
            error?: string;
        }>;
    };
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
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
};
export declare function heuristicClassify(input: ClassifyInput): ClassifyDecision;
export declare function classifyQuestions(): {
    failure_mode: import("./questions.js").ChoiceQuestion;
    recovery_urgency: import("./questions.js").ScoreQuestion;
    should_escalate: import("./questions.js").NoulQuestion;
    needs_maker_checker: import("./questions.js").NoulQuestion;
    context_rot: import("./questions.js").NoulQuestion;
};
export declare function classifyTrace(input: ClassifyInput, opts?: {
    systemOne?: SystemOneFn;
    allowFallback?: boolean;
}): Promise<ClassifyDecision>;
export declare function classifyExitCode(decision: ClassifyDecision): number;
