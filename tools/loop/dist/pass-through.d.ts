export type ToolId = 'init' | 'audit' | 'cost' | 'sync' | 'context' | 'worktree' | 'gate' | 'mcp' | 'sandbox' | 'jev';
/** Resolve absolute path to a tool CLI script, or null if only npx remains. */
export declare function resolveToolScript(id: ToolId): Promise<string | null>;
export interface SpawnResult {
    code: number;
    stdout: string;
    stderr: string;
}
/** Run a sibling tool; inherit stdio for interactive pass-through. */
export declare function runTool(id: ToolId, args: string[]): Promise<number>;
/** Run a sibling tool and capture stdout (for doctor/status). */
export declare function runToolCapture(id: ToolId, args: string[]): Promise<SpawnResult>;
export declare function toolPackageName(id: ToolId): string;
export declare function listToolIds(): ToolId[];
