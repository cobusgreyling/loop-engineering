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
/**
 * The scale `loop-sync --help` publishes: 90-100 healthy (no issues), 70-89
 * warning (minor inconsistencies), 0-69 critical. The report used to grade
 * below 40 critical and below 70 warning, so its healthy band reached down to
 * 70 and a single error issue (-20 -> 80) was still reported as healthy -- and
 * `loop-sync` exits 0 on healthy, which is how the one drift it calls an error,
 * a path documented in docs/safety.md but not enforced by gate.yaml, passed a
 * CI gate that trusts the exit code.
 */
export declare function levelForScore(score: number): DriftReport['level'];
export interface SyncOptions {
    targetDir: string;
    autoFix: boolean;
    dryRun: boolean;
    verbose: boolean;
    help?: boolean;
    json?: boolean;
}
/**
 * Extract frontmatter from markdown files
 */
export declare function extractFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
};
/**
 * Main sync function
 */
export declare function runSync(options: SyncOptions): Promise<DriftReport>;
/**
 * Format report for CLI output
 */
export declare function formatReport(report: DriftReport): string;
