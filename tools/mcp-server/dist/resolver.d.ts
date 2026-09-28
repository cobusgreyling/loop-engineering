/** Reject path segments that could escape the project root. */
export declare function assertSafeSegment(name: string, label: string): void;
export declare function fileExists(p: string): Promise<boolean>;
export declare function resolveProjectRoot(hint?: string): Promise<string>;
export declare function readFileIfExists(filePath: string): Promise<string | null>;
export interface PatternInfo {
    id: string;
    name: string;
    file: string;
    goal: string;
    cadence: string;
    risk: string;
    tools: string[];
    skills: string[];
    state: string;
    phases: string[];
    human_gates: string[];
    starter: string;
    week_one_mode: string;
    token_cost: string;
    cost: {
        tokens_noop: number;
        tokens_report: number;
        tokens_action: number;
        suggested_daily_cap: number;
        early_exit_required: boolean;
    };
}
export interface RegistryData {
    patterns: PatternInfo[];
}
export interface SkillInfo {
    name: string;
    path: string;
    content: string;
}
export declare function loadRegistry(root: string): Promise<RegistryData | null>;
export declare function loadPatternDoc(root: string, patternId: string): Promise<string | null>;
export declare function listSkills(root: string): Promise<SkillInfo[]>;
export declare function loadSkill(root: string, skillName: string): Promise<SkillInfo | null>;
/**
 * Prepended to state-file content served over MCP.
 *
 * The loop writes state files, but they carry text it copied from GitHub:
 * issue and PR titles, check names, CI excerpts. Anyone can open an issue, so
 * an agent reading STATE.md through this server is reading third-party text.
 * loadState() keeps returning the file verbatim; the server adds this notice
 * so the model is told where the content came from.
 */
export declare const UNTRUSTED_STATE_NOTICE: string;
export declare function markUntrustedState(content: string): string;
export declare function loadState(root: string, stateFile?: string): Promise<string | null>;
export declare function listStateFiles(root: string): Promise<string[]>;
export declare function loadLoopConfig(root: string): Promise<string | null>;
export declare function loadBudget(root: string): Promise<string | null>;
export declare function loadRunLog(root: string): Promise<string | null>;
export declare function loadSafetyDoc(root: string): Promise<string | null>;
export declare function loadGatePolicy(root: string): Promise<string | null>;
export declare function listPatternDocs(root: string): Promise<string[]>;
