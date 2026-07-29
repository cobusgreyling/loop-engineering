import { readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runInSandbox } from '@cobusgreyling/loop-sandbox';
export async function runSwarm(root, command, args, options) {
    const { count, ...sandboxOptions } = options;
    console.log(`\n🐝 Launching loop-swarm with ${count} sequential agents (serialized to prevent worktree races)...`);
    const results = [];
    for (let i = 0; i < count; i++) {
        console.log(`\n▶️ Agent ${i + 1}/${count}`);
        results.push(await runInSandbox(root, command, args, sandboxOptions));
    }
    console.log(`\n🧠 Analyzing swarm results...`);
    // Filter out runs that failed (non-zero exitCode)
    const successfulRuns = results.filter(r => r.exitCode === 0);
    const failedRuns = count - successfulRuns.length;
    if (failedRuns > 0) {
        console.log(`⚠️ ${failedRuns} agent(s) failed with non-zero exit codes. They are excluded from consensus voting.`);
    }
    // Count identical patches among successful runs
    const hashCounts = {};
    let noChangeCount = 0;
    for (const r of successfulRuns) {
        if (!r.hasChanges || !r.patchFile) {
            noChangeCount++;
            continue;
        }
        const buffer = await readFile(r.patchFile);
        const hash = createHash('sha256').update(buffer).digest('hex');
        if (!hashCounts[hash]) {
            hashCounts[hash] = { count: 0, files: [] };
        }
        hashCounts[hash].count++;
        hashCounts[hash].files.push(r.patchFile);
    }
    const threshold = Math.floor(count / 2) + 1; // Strict majority of total launched agents
    if (noChangeCount >= threshold) {
        console.log(`✅ Consensus reached! ${noChangeCount}/${count} agents produced NO changes (success).`);
        return {
            reached: true,
            majorityHash: null,
            majorityCount: noChangeCount,
            totalPatches: successfulRuns.length - noChangeCount,
            consensusPatchFile: null,
            divergentPatches: []
        };
    }
    // Find majority among patches
    let maxCount = 0;
    let majorityHash = null;
    for (const [hash, data] of Object.entries(hashCounts)) {
        if (data.count > maxCount) {
            maxCount = data.count;
            majorityHash = hash;
        }
    }
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
            totalPatches: successfulRuns.length - noChangeCount,
            consensusPatchFile,
            divergentPatches: divergentPatches.filter(f => !hashCounts[majorityHash].files.includes(f))
        };
    }
    const maxAgreement = Math.max(maxCount, noChangeCount);
    console.log(`❌ Swarm failed to reach consensus. (Highest agreement: ${maxAgreement}/${count})`);
    return {
        reached: false,
        majorityHash: null,
        majorityCount: maxAgreement,
        totalPatches: successfulRuns.length - noChangeCount,
        consensusPatchFile: null,
        divergentPatches
    };
}
