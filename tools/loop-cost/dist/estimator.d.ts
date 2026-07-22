export type ReadinessLevel = 'L1' | 'L2' | 'L3';
export declare const VALID_READINESS_LEVELS: ReadinessLevel[];
export declare function assertValidLevel(level: string): asserts level is ReadinessLevel;
export interface PatternCost {
    tokens_noop: number;
    tokens_report: number;
    tokens_action: number;
    /** Fraction (0.0-1.0) of report/action tokens that are stable, repeated
     *  content (STATE.md, skills, system prompt) eligible for prompt caching.
     *  Optional — patterns without it are treated as fully variable (0). */
    stable_fraction?: number;
    suggested_daily_cap: number;
    early_exit_required: boolean;
}
export interface RegistryPattern {
    id: string;
    name: string;
    cadence: string;
    token_cost: string;
    cost: PatternCost;
}
export interface RegistryDoc {
    patterns: RegistryPattern[];
}
export interface Orchestration {
    /** Normalized mode string, e.g. 'single', 'maker-checker', 'parallel:3', 'debate:2'. */
    mode: string;
    /** Multiplier applied to the action-path token cost. */
    multiplier: number;
}
/**
 * Parse an orchestration spec into a multiplier on the action path.
 *
 * The action path (implementer + verifier work) is where multi-agent
 * orchestration lands; the no-op scan and single triage pass are unaffected.
 *
 *   single         1x   one implementer pass, self-checked (default)
 *   maker-checker  2x   implementer + an independent verifier pass
 *   parallel:N     N+1  N candidate agents fan out, plus a merge/arbiter pass
 *   debate:R       1+R  one proposer plus R critique-and-revise rounds
 */
export declare function parseOrchestration(spec: string | undefined): Orchestration;
export interface EstimateInput {
    pattern: RegistryPattern;
    cadence?: string;
    level: ReadinessLevel;
    conservative?: boolean;
    orchestration?: string;
    withCaching?: boolean;
}
export interface EstimateResult {
    patternId: string;
    patternName: string;
    cadence: string;
    level: ReadinessLevel;
    runsPerDay: number;
    tokenCostTier: string;
    suggestedDailyCap: number;
    earlyExitRequired: boolean;
    orchestration: Orchestration;
    scenarios: {
        noop: {
            tokensPerRun: number;
            tokensPerDay: number;
        };
        report: {
            tokensPerRun: number;
            tokensPerDay: number;
        };
        action: {
            tokensPerRun: number;
            tokensPerDay: number;
        };
        realistic: {
            tokensPerRun: number;
            tokensPerDay: number;
            assumptions: string;
        };
        caching?: {
            tokensPerRun: number;
            tokensPerDay: number;
            savingsPercent: number;
        };
    };
    warnings: string[];
}
export declare function parseInterval(token: string): number;
/** Runs per day for a single interval like 15m or 1d. */
export declare function runsPerDayForInterval(interval: string): number;
/**
 * Parse pattern cadence (e.g. 5m-15m, 1d-2h) into runs/day.
 * conservative=true picks the slower cadence in a range.
 */
export declare function cadenceToRunsPerDay(cadence: string, conservative?: boolean): number;
export declare function estimateCost(input: EstimateInput): EstimateResult;
export declare function formatEstimateHuman(r: EstimateResult): string;
