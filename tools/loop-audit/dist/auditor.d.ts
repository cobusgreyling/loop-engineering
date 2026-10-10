import { Finding, BaseAuditResult } from '@cobusgreyling/readiness-core';
import { type ProofSignals } from './proof.js';
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
    governance: {
        toolScope: boolean;
        stallDetection: boolean;
        escalation: boolean;
        gateYaml: boolean;
    };
    constraints: {
        present: boolean;
        hasConstraintsSkill: boolean;
    };
    loopActivity: {
        present: boolean;
        evidence: string[];
    };
    /** harness-foundry runtime signals (LE → Foundry funnel). */
    harness: {
        stack: boolean;
        lock: boolean;
        sessions: boolean;
        emit: boolean;
        host: boolean;
    };
    /** memory-engineering setup (memory-tiers.md, memory-budget.md) */
    memory: {
        tiers: boolean;
        budget: boolean;
    };
    /** fleet-engineering setup (fleet-registry.md, fleet-inbox.md) */
    fleet: {
        registry: boolean;
        inbox: boolean;
    };
    /** Guardrails loop-drill showed firing (loop-drill.json). Optional so older callers still type-check. */
    proof?: ProofSignals;
}
export type { Finding };
export type { ProofSignals };
export interface AuditResult extends BaseAuditResult<'L0' | 'L1' | 'L2' | 'L3', LoopSignals> {
}
/**
 * A signal file counts only when it has content. Empty and whitespace-only
 * files, and JSON that is just {} or [], are placeholders: `touch` is not setup.
 */
export declare function hasContent(p: string): Promise<boolean>;
/**
 * Frontmatter with a name and a description: what Claude Code, Codex and Grok
 * need before they will load a skill or subagent. Without it the file is
 * never invoked, whatever it is called.
 */
export declare function hasSkillFrontmatter(text: string): boolean;
/**
 * A gate.yaml loop-gate can load declares `version: 1` and a denylist. This is
 * a shape check, not a parse; loop-drill's record proves the policy works.
 */
export declare function looksLikeGatePolicy(text: string): boolean;
/**
 * L3 means unattended actions behind gates, so the gate has to be shown to
 * fire, not just to exist: loop-drill must have drilled the current gate.yaml
 * in both directions, and no recorded guardrail may be failing.
 */
export declare function guardrailsProven(proof: ProofSignals | undefined): boolean;
/** Activity older than this does not count toward Loop Ready. */
export declare const ACTIVITY_MAX_AGE_MS: number;
export declare function computeScore(signals: LoopSignals): {
    score: number;
    level: 'L0' | 'L1' | 'L2' | 'L3';
    assessment: string;
};
export declare function auditProject(target: string): Promise<AuditResult>;
