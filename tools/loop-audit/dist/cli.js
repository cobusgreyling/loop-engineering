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
    console.log(`loop-audit — Loop Readiness Score CLI (v1.4+)

Usage:
  loop-audit [path] [options]

Options:
  --json      JSON output (for CI / scripting)
  --md        Markdown report
  --suggest   Show copy-from-template commands for missing pieces (recommended on first runs)
  --help, -h  This help

New in v1.4:
  • Dynamic "loop activity" detection (git history, "Last run" in STATE, scheduled workflows)
  • Higher L3 bar requires proven usage, not just files
  • Stronger recommendations when structure exists but no runs yet

Exit codes:
  0  score >= 40
  2  score < 40 (early stage or gate)

Examples:
  loop-audit .
  loop-audit . --suggest
  npx @cobusgreyling/loop-audit . --json
  npx @cobusgreyling/loop-audit starters/minimal-loop --suggest
  bash scripts/before-after-demo.sh
`);
    process.exit(0);
}
try {
    const result = await auditProject(target);
    if (json)
        console.log(formatJson(result));
    else if (md)
        console.log(formatMarkdown(result));
    else
        console.log(formatHuman(result));
    if (suggest) {
        console.log('\n=== Suggested actions (copy & customize) ===');
        console.log('From the root of this repo (or after cloning the reference):');
        console.log('');
        console.log('  # Minimal L1 daily triage — pick your tool');
        console.log('  # Grok:');
        console.log('  cp -r starters/minimal-loop/.grok/skills/loop-triage .grok/skills/');
        console.log('  # Claude Code:');
        console.log('  cp -r starters/minimal-loop-claude/.claude/skills/loop-triage .claude/skills/');
        console.log('  cp starters/minimal-loop-claude/.claude/agents/loop-verifier.md .claude/agents/');
        console.log('  # Codex:');
        console.log('  cp -r starters/minimal-loop-codex/.codex/skills/loop-triage .codex/skills/');
        console.log('  cp starters/minimal-loop-codex/.codex/agents/verifier.toml .codex/agents/');
        console.log('  # All tools:');
        console.log('  cp starters/minimal-loop/STATE.md.example STATE.md   # or -claude / -codex variant');
        console.log('  cp starters/minimal-loop/LOOP.md .');
        console.log('  cp templates/loop-budget.md.template loop-budget.md');
        console.log('  cp templates/loop-run-log.md.template loop-run-log.md');
        console.log('');
        console.log('  # Maker/checker verifier (Grok / generic skills dir)');
        console.log('  mkdir -p .grok/skills/loop-verifier');
        console.log('  cp templates/SKILL.md.verifier .grok/skills/loop-verifier/SKILL.md');
        console.log('');
        console.log('  # Common minimal fix action');
        console.log('  mkdir -p .grok/skills/minimal-fix');
        console.log('  cp templates/SKILL.md.minimal-fix .grok/skills/minimal-fix/SKILL.md');
        console.log('');
        console.log('  # For PR babysitter / CI sweeper patterns, copy the corresponding starter');
        console.log('  # Then run:  loop-audit . --suggest   (again after changes)');
        console.log('');
        console.log('  # Or scaffold automatically:');
        console.log('  npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok');
        console.log('  npx @cobusgreyling/loop-cost --pattern daily-triage --level L1');
        console.log('');
        console.log('  # IMPORTANT (v1.4): After scaffolding, actually RUN a loop (report-only) and commit the updated STATE.md.');
        console.log('  # This creates the "loopActivity" evidence that pushes you toward real L2/L3 scores.');
        console.log('');
        console.log('See docs/loop-design-checklist.md and patterns/ for full guidance.');
    }
    if (result.score < 40)
        process.exitCode = 2;
}
catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Audit failed:', msg);
    process.exitCode = 1;
}
