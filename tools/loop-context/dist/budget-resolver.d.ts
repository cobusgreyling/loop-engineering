export type BudgetScenario = 'realistic' | 'action' | 'report' | 'caching';
export declare const VALID_BUDGET_SCENARIOS: BudgetScenario[];
export declare function assertValidBudgetScenario(scenario: string): asserts scenario is BudgetScenario;
export interface BudgetFromPatternInput {
    pattern: string;
    level?: string;
    scenario?: BudgetScenario;
    cadence?: string;
    conservative?: boolean;
}
/** Locate loop-cost's built CLI: monorepo sibling first, then an installed dependency. */
export declare function resolveCostCli(): Promise<string | null>;
/**
 * Resolve a token budget from loop-cost's realistic per-pattern estimate
 * instead of a hand-typed number.
 */
export declare function resolveTokenBudgetFromPattern(input: BudgetFromPatternInput): Promise<number>;
/**
 * Resolve a pattern's suggested daily token cap from loop-cost, for
 * cross-run daily spend tracking (see daily-spend.ts).
 */
export declare function resolveDailyBudgetFromPattern(input: BudgetFromPatternInput): Promise<number>;
