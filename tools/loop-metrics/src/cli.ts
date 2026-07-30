#!/usr/bin/env node

import { parseArgs } from 'node:util';
import path from 'node:path';
import { parseLogFile, filterEntries, aggregateMetrics } from './metrics.js';

const { values } = parseArgs({
  options: {
    log: { type: 'string', default: 'loop-run-log.md' },
    pattern: { type: 'string' },
    timeframe: { type: 'string' },
    help: { type: 'boolean' }
  }
});

if (values.help) {
  console.log(`
Usage: npx @cobusgreyling/loop-metrics [options]

Options:
  --log <path>       Path to loop-run-log.md (default: ./loop-run-log.md)
  --pattern <name>   Filter by pattern (e.g. daily-triage)
  --timeframe <days> Filter by timeframe (e.g. 7d, 30d)
  --help             Show this help message
`);
  process.exit(0);
}

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

async function main() {
  try {
    const logPath = path.resolve(process.cwd(), values.log as string);
    const entries = await parseLogFile(logPath);

    let days: number | undefined;
    if (values.timeframe) {
      const match = values.timeframe.match(/^(\d+)d$/);
      if (match) {
        days = parseInt(match[1], 10);
      } else {
        console.error(`${red}Error: Invalid timeframe format. Use e.g., 7d, 30d.${reset}`);
        process.exit(1);
      }
    }

    const filtered = filterEntries(entries, values.pattern, days);
    const metrics = aggregateMetrics(filtered);

    console.log(`\n${bold}${cyan}╔════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${bold}${cyan}║                Loop Engineering Metrics                ║${reset}`);
    console.log(`${bold}${cyan}╚════════════════════════════════════════════════════════╝${reset}\n`);

    console.log(`  ${bold}Filter:${reset}    ${values.pattern || 'All Patterns'}`);
    console.log(`  ${bold}Timeframe:${reset} ${values.timeframe || 'All Time'}`);
    console.log(`  ${bold}Log File:${reset}  ${values.log}\n`);

    console.log(`  ${bold}Total Runs:${reset}        ${metrics.totalRuns}`);
    
    // Format tokens (e.g. 1.2M, 520k)
    const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);
    console.log(`  ${bold}Tokens Burned:${reset}     ${fmt(metrics.totalTokens)}`);
    console.log(`  ${bold}Avg Duration:${reset}      ${metrics.avgDurationS.toFixed(1)}s\n`);

    console.log(`  ${bold}Actions Taken:${reset}     ${green}${metrics.totalActionsTaken}${reset}`);
    
    const escColor = metrics.totalEscalations > 0 ? red : green;
    console.log(`  ${bold}Escalations:${reset}       ${escColor}${metrics.totalEscalations}${reset}`);

    const succColor = metrics.successRatePct >= 80 ? green : metrics.successRatePct >= 50 ? yellow : red;
    console.log(`  ${bold}Success Rate:${reset}      ${succColor}${metrics.successRatePct.toFixed(1)}%${reset}`);

    const roiColor = metrics.roiScore > 0 ? green : red;
    console.log(`  ${bold}ROI Score:${reset}         ${roiColor}${metrics.roiScore}${reset}\n`);
    
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error(`${red}Error: Could not find ${values.log}.${reset}`);
      console.error(`Are you in a repository root with a loop-run-log.md?`);
    } else {
      console.error(`${red}Error:${reset}`, err.message);
    }
    process.exit(1);
  }
}

main();
