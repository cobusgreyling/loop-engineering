/**
 * Loop Sync - Detect and sync drift between Loop configuration files
 *
 * This module detects:
 * 1. STATE.md ↔ LOOP.md consistency
 * 2. Skills version updates
 * 3. Missing required files
 * 4. Configuration drift from starters
 */
export interface DriftReport {
    score: number;
    level: 'healthy' | 'warning' | 'critical';
    issues: DriftIssue[];
    suggestions: string[];
    timestamp: string;
}
export interface DriftIssue {
    type: 'missing' | 'outdated' | 'inconsistent' | 'orphaned';
    file: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    suggestion?: string;
}
export interface SyncOptions {
    targetDir: string;
    autoFix: boolean;
    dryRun: boolean;
    verbose: boolean;
    help?: boolean;
    json?: boolean;
}
/**
 * Main sync function
 */
export declare function runSync(options: SyncOptions): Promise<DriftReport>;
/**
 * Format report for CLI output
 */
export declare function formatReport(report: DriftReport): string;
