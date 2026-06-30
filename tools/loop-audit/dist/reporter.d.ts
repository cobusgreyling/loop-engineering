import type { AuditResult } from './auditor.js';
/** ASCII progress bar for terminal + demo GIFs. */
export declare function formatScoreBar(score: number, width?: number): string;
/** Markdown badge for README — paste output from `loop-audit . --badge`. */
export declare function formatBadge(r: AuditResult): string;
export declare function formatHuman(r: AuditResult): string;
export declare function formatJson(r: AuditResult): string;
export declare function formatMarkdown(r: AuditResult): string;
