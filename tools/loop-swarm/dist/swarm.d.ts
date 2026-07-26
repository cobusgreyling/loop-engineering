import { SandboxOptions } from '@cobusgreyling/loop-sandbox';
export interface SwarmOptions extends SandboxOptions {
    count: number;
}
export interface ConsensusResult {
    reached: boolean;
    majorityHash: string | null;
    majorityCount: number;
    totalPatches: number;
    consensusPatchFile: string | null;
    divergentPatches: string[];
}
export declare function runSwarm(root: string, command: string, args: string[], options: SwarmOptions): Promise<ConsensusResult>;
