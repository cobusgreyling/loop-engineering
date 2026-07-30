export interface RunEntry {
    run_id: string;
    pattern: string;
    duration_s: number;
    items_found: number;
    actions_taken: number;
    escalations: number;
    tokens_estimate: number;
    outcome: string;
}
export interface MetricsDashboard {
    totalRuns: number;
    totalTokens: number;
    totalDurationS: number;
    totalActionsTaken: number;
    totalEscalations: number;
    successRatePct: number;
    roiScore: number;
    avgDurationS: number;
}
export declare function parseLogFile(filePath: string): Promise<RunEntry[]>;
export declare function filterEntries(entries: RunEntry[], pattern?: string, days?: number): RunEntry[];
export declare function aggregateMetrics(entries: RunEntry[]): MetricsDashboard;
