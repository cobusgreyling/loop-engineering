/**
 * Evidence-aware PR promotion gate.
 *
 * Static path policy answers "may this kind of change be auto-merged?".
 * Promotion evidence answers the equally important "was this exact PR SHA
 * actually reviewed, deployed, seeded, tested, and accepted?".
 */
import { type GateConfig } from './gate.js';
export type EvidenceStatus = 'success' | 'failure' | 'pending';
export type DatasetKind = 'synthetic' | 'sanitized' | 'production';
export type AcceptanceMode = 'never' | 'always' | 'risk-based';
export interface PromotionContract {
    version: 1;
    authorization: {
        labels: string[];
        minApprovals: number;
    };
    pullRequest: {
        baseBranches: string[];
        requireCleanMerge: boolean;
        requireResolvedThreads: boolean;
        sameRepositoryOnly: boolean;
        maxAttempts: number;
    };
    checks: {
        required: string[];
    };
    deployment: {
        required: boolean;
        environment: string;
        maxAgeHours?: number;
    };
    testData: {
        required: boolean;
        allowedKinds: DatasetKind[];
        requireVersion: boolean;
    };
    e2e: {
        requiredSuites: string[];
        pathSuites?: Array<{
            paths: string[];
            suites: string[];
        }>;
        requireDatasetMatch: boolean;
        maxAgeHours?: number;
    };
    manualAcceptance: {
        mode: AcceptanceMode;
        riskLevels?: string[];
        maxAgeHours?: number;
    };
}
export interface PromotionEvidence {
    version: 1;
    observedAt: string;
    pullRequest: {
        number: number;
        headSha: string;
        baseBranch: string;
        baseRepository: string;
        headRepository: string;
        draft: boolean;
        mergeState: string;
        labels: string[];
        approvals: number;
        /** Commit SHA reviewed by the counted approvals. */
        approvalSha?: string;
        changesRequested: boolean;
        unresolvedThreads: number;
        attempts: number;
        riskLevel: string;
        changedPaths: string[];
    };
    checks: Array<{
        name: string;
        status: EvidenceStatus;
        sha: string;
        completedAt?: string;
        url?: string;
    }>;
    deployment?: {
        environment: string;
        status: EvidenceStatus;
        sha: string;
        completedAt: string;
        url?: string;
    };
    testData?: {
        kind: DatasetKind;
        version?: string;
        status: EvidenceStatus;
        sha: string;
        completedAt: string;
    };
    e2e: Array<{
        suite: string;
        status: EvidenceStatus;
        sha: string;
        datasetVersion?: string;
        completedAt: string;
        url?: string;
    }>;
    manualAcceptance?: {
        status: EvidenceStatus;
        sha: string;
        completedAt: string;
        actor?: string;
    };
}
export type PromotionStage = 'intake' | 'policy' | 'review' | 'checks' | 'deployment' | 'test-data' | 'e2e' | 'acceptance' | 'merge-ready';
export type PromotionIssueKind = 'blocked' | 'waiting' | 'human-required';
export interface PromotionIssue {
    code: string;
    stage: Exclude<PromotionStage, 'merge-ready'>;
    kind: PromotionIssueKind;
    message: string;
}
export interface PromotionDecision {
    allowed: boolean;
    stage: PromotionStage;
    headSha: string;
    pullRequest: number;
    issues: PromotionIssue[];
    summary: string;
}
export declare function parsePromotionContract(value: unknown, source?: string): PromotionContract;
export declare function parsePromotionEvidence(value: unknown, source?: string): PromotionEvidence;
export declare function loadPromotionContract(file: string): Promise<PromotionContract>;
export declare function loadPromotionEvidence(file: string): Promise<PromotionEvidence>;
export declare function evaluatePromotion(contract: PromotionContract, evidence: PromotionEvidence, pathPolicy?: GateConfig): PromotionDecision;
