/** Deterministic intake planner for issue-first repair loops. */
export type RepairTargetType = 'issue' | 'pull-request';
export type ReproductionState = 'confirmed' | 'unknown' | 'failed';
export type CheckState = 'success' | 'failure' | 'pending' | 'absent';
export type FailureClass = 'deterministic' | 'unknown' | 'flake' | 'infrastructure';
export type RepairMode = 'change' | 'diagnose' | 'propose';
export interface RepairContract {
    version: 1;
    labels: {
        pause: string;
        lock: string;
        bug: string;
        attemptsPrefix: string;
        priority: string[];
        sensitive: string[];
    };
    maxAttempts: number;
    sensitivePaths: string[];
}
export interface RepairTargetEvidence {
    type: RepairTargetType;
    number: number;
    title: string;
    updatedAt: string;
    labels: string[];
    changedPaths?: string[];
    linkedPullRequest?: number;
    reproduction?: ReproductionState;
    headSha?: string;
    branchOwned?: boolean;
    reviewActionable?: boolean;
    check?: {
        status: CheckState;
        failureClass: FailureClass;
    };
}
export interface RepairEvidence {
    version: 1;
    observedAt: string;
    repository: string;
    pauseIssues: number[];
    targets: RepairTargetEvidence[];
}
export interface RepairIssue {
    code: string;
    kind: 'waiting' | 'human-required';
    message: string;
    target?: string;
}
export interface RepairSelection {
    type: RepairTargetType;
    number: number;
    title: string;
    action: 'repair-issue' | 'diagnose-issue' | 'address-review' | 'repair-check' | 'diagnose-check';
    mode: RepairMode;
    attempts: number;
    headSha?: string;
    reason: string;
}
export interface RepairDecision {
    state: 'selected' | 'idle' | 'paused' | 'locked' | 'human-required';
    repository: string;
    selected?: RepairSelection;
    issues: RepairIssue[];
    summary: string;
}
export declare function parseRepairContract(value: unknown, source?: string): RepairContract;
export declare function parseRepairEvidence(value: unknown, source?: string): RepairEvidence;
export declare function evaluateRepair(contract: RepairContract, evidence: RepairEvidence): RepairDecision;
export declare function loadRepairContract(path: string): Promise<RepairContract>;
export declare function loadRepairEvidence(path: string): Promise<RepairEvidence>;
