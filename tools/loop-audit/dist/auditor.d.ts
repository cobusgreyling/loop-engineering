export interface LoopSignals {
    stateFile: {
        present: boolean;
        paths: string[];
    };
    loopConfig: {
        present: boolean;
        path?: string;
    };
    skills: {
        count: number;
        loopSkills: string[];
    };
    verifier: {
        present: boolean;
    };
    triage: {
        present: boolean;
    };
    agentsMd: {
        present: boolean;
    };
    patterns: {
        documented: boolean;
    };
    safety: {
        loopMdMentionsSafety: boolean;
        safetyDocPresent: boolean;
    };
    starters: {
        used: boolean;
    };
    github: {
        present: boolean;
        workflows: boolean;
    };
    mcp: {
        present: boolean;
    };
    worktreeEvidence: {
        present: boolean;
    };
    registry: {
        present: boolean;
    };
    cost: {
        budgetDoc: boolean;
        runLog: boolean;
        loopMdBudget: boolean;
        budgetSkill: boolean;
    };
    constraints: {
        present: boolean;
        hasConstraintsSkill: boolean;
    };
    loopActivity: {
        present: boolean;
        evidence: string[];
    };
}
export interface Finding {
    level: 'ok' | 'warn' | 'fail';
    message: string;
}
export interface AuditResult {
    target: string;
    score: number;
    level: 'L0' | 'L1' | 'L2' | 'L3';
    assessment: string;
    signals: LoopSignals;
    findings: Finding[];
    recommendations: string[];
}
export declare function computeScore(signals: LoopSignals): {
    score: number;
    level: 'L0' | 'L1' | 'L2' | 'L3';
    assessment: string;
};
export declare function auditProject(target: string): Promise<AuditResult>;
