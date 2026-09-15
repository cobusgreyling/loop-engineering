import { readFile } from 'node:fs/promises';

export interface RunEntry {
  run_id: string;
  pattern: string;
  duration_s: number;
  items_found: number;
  actions_taken: number;
  escalations: number;
  tokens_estimate: number;
  outcome: string;
}

export interface MetricsDashboard {
  totalRuns: number;
  totalTokens: number;
  totalDurationS: number;
  totalActionsTaken: number;
  totalEscalations: number;
  successRatePct: number;
  roiScore: number;
  avgDurationS: number;
}

export async function parseLogFile(filePath: string): Promise<RunEntry[]> {
  const content = await readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const entries: RunEntry[] = [];
  let inLogSection = false;

  for (const line of lines) {
    if (line.includes('<!-- Loop appends below this line -->')) {
      inLogSection = true;
      continue;
    }
    if (!inLogSection || line.trim() === '') continue;

    try {
      const entry = JSON.parse(line.trim());
      if (entry.run_id && entry.pattern) {
        entries.push(entry as RunEntry);
      }
    } catch (e) {
      // Ignore malformed lines
    }
  }

  return entries;
}

export function filterEntries(entries: RunEntry[], pattern?: string, days?: number): RunEntry[] {
  let filtered = entries;

  if (pattern) {
    filtered = filtered.filter(e => e.pattern === pattern);
  }

  if (days && days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    filtered = filtered.filter(e => {
      // Match the run-log pruner: Date also accepts IDs such as "run-1"
      // as old dates, so only ISO-shaped IDs can establish a run's age.
      if (!/^\d{4}-\d{2}-\d{2}/.test(e.run_id)) return true;
      const entryDate = new Date(e.run_id);
      // An unparseable run_id (e.g. a numeric GitHub run id or a custom
      // slug) yields Invalid Date; keep the entry rather than silently
      // dropping it from the timeframe view.
      if (Number.isNaN(entryDate.getTime())) return true;
      return entryDate >= cutoffDate;
    });
  }

  return filtered;
}

export function aggregateMetrics(entries: RunEntry[]): MetricsDashboard {
  let totalTokens = 0;
  let totalDurationS = 0;
  let totalActionsTaken = 0;
  let totalEscalations = 0;
  let runsWithoutEscalation = 0;

  for (const entry of entries) {
    totalTokens += entry.tokens_estimate || 0;
    totalDurationS += entry.duration_s || 0;
    totalActionsTaken += entry.actions_taken || 0;
    totalEscalations += entry.escalations || 0;
    if (!entry.escalations) runsWithoutEscalation++;
  }

  const totalRuns = entries.length;
  // totalEscalations is a sum of each run's escalation *count* (a run can
  // log more than one, e.g. several items escalated in one triage pass) --
  // subtracting it from totalRuns (a count of runs) conflates events with
  // runs and can go negative for a real, ordinary run log (this repo's own
  // loop-run-log.md has entries with escalations: 4 and escalations: 5).
  // Success rate is "what fraction of runs didn't escalate at all", which
  // stays correctly bounded to [0, 100] regardless of how many escalations
  // any single run logged.
  const successRatePct = totalRuns > 0 ? (runsWithoutEscalation / totalRuns) * 100 : 0;
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
