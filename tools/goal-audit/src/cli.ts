#!/usr/bin/env node
import { auditProject } from './auditor.js';
import { formatHuman, formatJson, formatMarkdown } from './reporter.js';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-')) || '.';
const json = args.includes('--json');
const md = args.includes('--md');
const suggest = args.includes('--suggest') || args.includes('--fix');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`goal-audit — Goal Readiness Score CLI (G0–G3)

Usage:
  goal-audit [path] [options]

Options:
  --json      JSON output (for CI / scripting)
  --md        Markdown report
  --suggest   Show copy-from-template commands
  --fix       Alias for --suggest (prints commands, does not modify files)
  --help, -h  This help

Scores goal readiness for Grok Build /goal:
  GOAL.md, verifier skills, AGENTS.md, tests, CI, budget docs

Exit codes:
  0  score >= 40
  2  score < 40

Examples:
  goal-audit .
  goal-audit . --suggest
  npx @cobusgreyling/goal-audit . --json
`);
  process.exit(0);
}

try {
  const result = await auditProject(target);
  if (json) console.log(formatJson(result));
  else if (md) console.log(formatMarkdown(result));
  else console.log(formatHuman(result));

  if (suggest) {
    console.log('\n=== Suggested actions ===');
    console.log('');
    console.log('  cp templates/GOAL.md.template GOAL.md');
    console.log('  cp -r starters/minimal-goal/.grok/skills/goal-verifier .grok/skills/');
    console.log('  cp templates/goal-budget.md.template goal-budget.md');
    console.log('  cp templates/goal-run-log.md.template goal-run-log.md');
    console.log('');
    console.log('  # Then in Grok Build:');
    console.log('  /goal Read GOAL.md. Work the objective. goal-verifier before completed: true.');
    console.log('');
    console.log('  Docs: https://github.com/cobusgreyling/goal-engineering');
  }

  process.exit(result.score >= 40 ? 0 : 2);
} catch (err) {
  console.error('goal-audit error:', err instanceof Error ? err.message : err);
  process.exit(1);
}