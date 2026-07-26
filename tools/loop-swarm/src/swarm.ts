import { readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runInSandbox, SandboxOptions, SandboxResult } from '@cobusgreyling/loop-sandbox';

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

export async function runSwarm(root: string, command: string, args: string[], options: SwarmOptions): Promise<ConsensusResult> {
  const { count, ...sandboxOptions } = options;

  console.log(`\n🐝 Launching loop-swarm with ${count} concurrent agents...`);

  const promises: Promise<SandboxResult>[] = [];
  for (let i = 0; i < count; i++) {
    promises.push(runInSandbox(root, command, args, sandboxOptions));
  }

  // Wait for all to finish
  const results = await Promise.all(promises);

  console.log(`\n🧠 Analyzing swarm results...`);

  // Group by hash
  const patches = results.filter(r => r.patchFile !== null && r.hasChanges).map(r => r.patchFile as string);
  
  if (patches.length === 0) {
    console.log(`ℹ️ No changes were produced by any agent in the swarm.`);
    return {
      reached: true, // Trivially reached consensus on "no changes"
      majorityHash: null,
      majorityCount: count, // All returned no changes
      totalPatches: 0,
      consensusPatchFile: null,
      divergentPatches: []
    };
  }

  const hashCounts: Record<string, { count: number; files: string[] }> = {};

  for (const patchFile of patches) {
    const buffer = await readFile(patchFile);
    const hash = createHash('sha256').update(buffer).digest('hex');
    
    if (!hashCounts[hash]) {
      hashCounts[hash] = { count: 0, files: [] };
    }
    hashCounts[hash].count++;
    hashCounts[hash].files.push(patchFile);
  }

  // Find majority
  let maxCount = 0;
  let majorityHash: string | null = null;
  for (const [hash, data] of Object.entries(hashCounts)) {
    if (data.count > maxCount) {
      maxCount = data.count;
      majorityHash = hash;
    }
  }

  const threshold = Math.floor(count / 2) + 1; // Strict majority
  
  const divergentPatches = Object.values(hashCounts).flatMap(d => d.files);

  if (maxCount >= threshold && majorityHash) {
    console.log(`✅ Consensus reached! ${maxCount}/${count} agents produced the exact same patch.`);
    
    const representativePatch = hashCounts[majorityHash].files[0];
    const consensusPatchFile = path.join(path.dirname(representativePatch), 'consensus.patch');
    
    await copyFile(representativePatch, consensusPatchFile);
    console.log(`🎉 Consensus patch saved to: ${consensusPatchFile}`);
    
    return {
      reached: true,
      majorityHash,
      majorityCount: maxCount,
      totalPatches: patches.length,
      consensusPatchFile,
      divergentPatches: divergentPatches.filter(f => !hashCounts[majorityHash!].files.includes(f))
    };
  }

  console.log(`❌ Swarm failed to reach consensus. (Highest agreement: ${maxCount}/${count})`);
  
  return {
    reached: false,
    majorityHash: null,
    majorityCount: maxCount,
    totalPatches: patches.length,
    consensusPatchFile: null,
    divergentPatches
  };
}
