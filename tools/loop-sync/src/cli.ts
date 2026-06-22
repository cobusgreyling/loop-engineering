#!/usr/bin/env node
/**
 * Loop Sync CLI
 * 
 * Detect and sync drift between Loop configuration files
 */

import { runSync, formatReport, type SyncOptions, type DriftReport } from './sync.js';

function parseArgs(argv: string[]): SyncOptions {
  let targetDir = '.';
  let autoFix = false;
  let dryRun = false;
  let verbose = false;
  let json = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--auto-fix' || a === '-a') autoFix = true;
    else if (a === '--dry-run' || a === '-d') dryRun = true;
    else if (a === '--verbose' || a === '-v') verbose = true;
    else if (a === '--json') json = true;
    else if (!a.startsWith('-')) targetDir = a;
  }

  return { targetDir, autoFix, dryRun, verbose, help };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`loop-sync — detect and sync drift between Loop configuration files

Usage:
  loop-sync [target-dir] [options]

Options:
  -a, --auto-fix    Attempt to auto-fix issues (experimental)
  -d, --dry-run     Show what would be done without making changes
  -v, --verbose     Show detailed information
  --json            Output JSON format
  -h, --help        Show this help

Examples:
  loop-sync .
  loop-sync ./my-project -v
  loop-sync ./my-project --json

The tool checks:
  - STATE.md ↔ LOOP.md consistency
  - Required files (STATE.md, LOOP.md, AGENTS.md)
  - Skills directory structure
  - Configuration drift indicators

Score interpretation:
  - 90-100: Healthy (no issues)
  - 70-89: Warning (minor inconsistencies)
  - 0-69: Critical (major issues need attention)

Docs: https://github.com/cobusgreyling/loop-engineering/tree/main/tools/loop-sync
`);
    process.exit(0);
  }

  try {
    const report = await runSync(args);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReport(report));
    }

    // Exit with appropriate code
    if (report.level === 'critical') {
      process.exit(1);
    } else if (report.level === 'warning') {
      process.exit(2);
    }
  } catch (error) {
    console.error('loop-sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();