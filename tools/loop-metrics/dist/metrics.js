import { readFile } from 'node:fs/promises';
export async function parseLogFile(filePath) {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const entries = [];
    let inLogSection = false;
    for (const line of lines) {
        if (line.includes('<!-- Loop appends below this line -->')) {
            inLogSection = true;
            continue;
        }
        if (!inLogSection || line.trim() === '')
            continue;
        try {
            const entry = JSON.parse(line.trim());
            if (entry.run_id && entry.pattern) {
                entries.push(entry);
            }
        }
        catch (e) {
            // Ignore malformed lines
        }
    }
    return entries;
}
export function filterEntries(entries, pattern, days) {
    let filtered = entries;
    if (pattern) {
        filtered = filtered.filter(e => e.pattern === pattern);
    }
    if (days && days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filtered = filtered.filter(e => {
            const entryDate = new Date(e.run_id);
            // An unparseable run_id (e.g. a numeric GitHub run id or a custom
            // slug) yields Invalid Date; keep the entry rather than silently
            // dropping it from the timeframe view.
            if (Number.isNaN(entryDate.getTime()))
                return true;
            return entryDate >= cutoffDate;
        });
    }
    return filtered;
}
export function aggregateMetrics(entries) {
    let totalTokens = 0;
    let totalDurationS = 0;
    let totalActionsTaken = 0;
    let totalEscalations = 0;
    for (const entry of entries) {
        totalTokens += entry.tokens_estimate || 0;
        totalDurationS += entry.duration_s || 0;
        totalActionsTaken += entry.actions_taken || 0;
        totalEscalations += entry.escalations || 0;
    }
    const totalRuns = entries.length;
    const successRatePct = totalRuns > 0 ? ((totalRuns - totalEscalations) / totalRuns) * 100 : 0;
    const avgDurationS = totalRuns > 0 ? totalDurationS / totalRuns : 0;
    // Simple heuristic: Each successful action is worth +10, each escalation is -5.
    const roiScore = (totalActionsTaken * 10) - (totalEscalations * 5);
    return {
        totalRuns,
        totalTokens,
        totalDurationS,
        totalActionsTaken,
        totalEscalations,
        successRatePct,
        roiScore,
        avgDurationS
    };
}
